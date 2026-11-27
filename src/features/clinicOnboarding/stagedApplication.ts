import { createHash, randomUUID } from 'node:crypto'
import { APIError, type PayloadRequest } from 'payload'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import { findDuplicateClinicApplication } from '@/collections/clinicApplications/findDuplicateApplication'
import { clinicApplicationProvisioningInputFields } from '@/collections/clinicApplications/provisioningLifecycle'
import { runClinicRegistrationTransaction } from '@/features/clinicRegistration/transactions'
import { requireCurrentPlatformStaff } from '@/features/clinicDashboard/gallery/platformGallery'
import type { ClinicApplication } from '@/payload-types'
import { slugify } from '@/utilities/slugify'
import { readEligibleExistingClinicStaff } from './existingStaff'
import { withMcpOnboardingWrite } from './stagedWriteGuards'
import { releaseAbandonedClinicStaffEmail } from './staffEmailReservation'
import {
  getStagedOnboardingBinding,
  getStagedOnboardingIdentity,
  readBoundStagedClinic,
  readBoundStagedNewStaff,
} from './stagedBinding'

type Intake = Pick<
  ClinicApplication,
  'clinicName' | 'clinicWebsite' | 'contactEmail' | 'contactFirstName' | 'contactLastName' | 'contactRole'
> & { medicalSpecialtyIds: number[] }

type StageInput = { requestKey: string } & (
  | (Intake & { staffMode: 'new_account' })
  | (Omit<Intake, 'contactEmail' | 'contactFirstName' | 'contactLastName'> &
      Partial<Pick<Intake, 'contactFirstName' | 'contactLastName'>> & {
        staffMode: 'existing_account'
        clinicStaffId: number
      })
)
type Correction = Partial<Intake> & { applicationId: number; clinicStaffId?: number }

export class McpOnboardingError extends APIError {
  constructor(message: string, status: number) {
    super(message, status, undefined, true)
  }
}

export async function requireClinicOnboardingOperator(req: PayloadRequest) {
  if (!(await platformClinicTrustAccess({ req }))) {
    throw new McpOnboardingError('Clinic onboarding requires current clinic management access.', 403)
  }
}

async function verifyMainSpecialties(req: PayloadRequest, medicalSpecialtyIds: number[]) {
  const ids = [...new Set(medicalSpecialtyIds)]
  const result = await req.payload.find({
    collection: 'medical-specialties',
    depth: 0,
    limit: ids.length,
    pagination: false,
    select: { parentSpecialty: true },
    where: {
      and: [{ id: { in: ids } }, { parentSpecialty: { exists: false } }],
    },
    overrideAccess: false,
    req,
  })
  if (result.docs.length !== ids.length) throw new McpOnboardingError('Select valid main medical specialties.', 400)
  return ids
}

async function requireUnusedClinicStaffEmail(req: PayloadRequest, email: string, excludeStaffId?: number) {
  for (;;) {
    const match = (
      await req.payload.find({
        collection: 'clinicStaff',
        depth: 0,
        limit: 1,
        pagination: false,
        select: { email: true },
        where: {
          email: { equals: email },
          ...(excludeStaffId === undefined ? {} : { id: { not_equals: excludeStaffId } }),
        },
        overrideAccess: false,
        req,
      })
    ).docs[0]
    if (!match) return
    if (!(await releaseAbandonedClinicStaffEmail(req, match.id))) {
      throw new McpOnboardingError('The first contact email is already in use.', 409)
    }
  }
}

async function findApplicationByRequestKey(req: PayloadRequest, requestKey: string) {
  const result = await req.payload.find({
    collection: 'clinicApplications',
    depth: 0,
    limit: 1,
    where: { mcpOnboardingRequestKey: { equals: requestKey } },
    overrideAccess: true,
    req,
  })
  return result.docs[0]
}

export async function readStagedApplication(req: PayloadRequest, applicationId: number) {
  const authorizedApplication = await req.payload.findByID({
    collection: 'clinicApplications',
    id: applicationId,
    depth: 0,
    overrideAccess: false,
    disableErrors: true,
    req,
  })
  if (!authorizedApplication) throw new McpOnboardingError('Clinic onboarding application not found.', 404)
  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id: applicationId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (!application.mcpOnboardingStaffMode || !application.mcpOnboardingRequestKey) {
    throw new McpOnboardingError('Clinic onboarding application not found.', 404)
  }
  return application
}

export function getApplicationRevision(application: ClinicApplication): string {
  // Bind the reviewed intake and staff selection even when two writes share a timestamp.
  return createHash('sha256')
    .update(
      JSON.stringify([
        application.id,
        application.updatedAt,
        application.linkedRecords?.clinic,
        application.linkedRecords?.clinicStaff,
        application.mcpOnboardingStaffMode,
        application.status,
        application.provisioningStatus,
        application.provisioningErrorCode,
        application.medicalSpecialties,
        ...clinicApplicationProvisioningInputFields.map((field) => application[field]),
      ]),
    )
    .digest('hex')
}

export async function readOnboardingStatus(req: PayloadRequest, application: ClinicApplication) {
  const { clinic: clinicId, clinicStaff: clinicStaffId } = application.linkedRecords ?? {}
  if (typeof clinicId !== 'number' || typeof clinicStaffId !== 'number') {
    throw new McpOnboardingError('The clinic onboarding records are incomplete.', 409)
  }
  const result = await req.payload.findByID({
    collection: 'clinics',
    id: clinicId,
    depth: 0,
    overrideAccess: false,
    disableErrors: true,
    select: { status: true },
    req,
  })
  if (!result) throw new McpOnboardingError('The linked clinic is unavailable.', 409)
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    id: clinicId,
    depth: 0,
    overrideAccess: true,
    select: { status: true, participationStatus: true },
    req,
  })
  return {
    applicationId: application.id,
    applicationRevision: getApplicationRevision(application),
    clinicId,
    clinicStaffId,
    staffMode: application.mcpOnboardingStaffMode,
    decisionStatus: application.status,
    accountSetupStatus: application.provisioningStatus ?? 'not_started',
    ...(application.provisioningErrorCode ? { accountSetupErrorCode: application.provisioningErrorCode } : {}),
    participationStatus: clinic.participationStatus,
    publicStatus: clinic.status,
  }
}

async function requireSelectedClinicStaff(req: PayloadRequest, clinicStaffId: number) {
  const staff = await readEligibleExistingClinicStaff(req, { clinicStaffId })
  if (!staff) throw new McpOnboardingError('The selected staff account is unavailable or ineligible.', 409)
  return staff
}

function getSelectedStaffContact(
  staff: Awaited<ReturnType<typeof requireSelectedClinicStaff>>,
  { contactFirstName, contactLastName }: Pick<Partial<Intake>, 'contactFirstName' | 'contactLastName'>,
) {
  const lastName = contactLastName ?? staff.lastName?.trim()
  if (!lastName) throw new McpOnboardingError('Provide the selected contact’s last name.', 400)
  return {
    contactEmail: normalizeEmail(staff.email),
    contactFirstName: contactFirstName ?? (staff.firstName?.trim() || null),
    contactLastName: lastName,
  }
}

export async function stageClinicOnboarding(req: PayloadRequest, input: StageInput) {
  const requestKey = createHash('sha256')
    .update(JSON.stringify([req.user?.id, input.requestKey]))
    .digest('hex')
  const { staffMode, medicalSpecialtyIds, clinicName, clinicWebsite, contactRole } = input

  return runClinicRegistrationTransaction(req, async (transactionReq) => {
    await requireClinicOnboardingOperator(transactionReq)
    const existing = await findApplicationByRequestKey(transactionReq, requestKey)
    if (existing) return readOnboardingStatus(transactionReq, await readStagedApplication(transactionReq, existing.id))

    let selectedStaffId: number | undefined
    let contact: Pick<Intake, 'contactEmail' | 'contactFirstName' | 'contactLastName'>
    if (input.staffMode === 'existing_account') {
      const staff = await requireSelectedClinicStaff(transactionReq, input.clinicStaffId)
      selectedStaffId = staff.clinicStaffId
      contact = getSelectedStaffContact(staff, input)
    } else {
      contact = {
        contactEmail: normalizeEmail(input.contactEmail),
        contactFirstName: input.contactFirstName,
        contactLastName: input.contactLastName,
      }
    }
    const intake = { clinicName, clinicWebsite, contactRole, ...contact }
    if (await findDuplicateClinicApplication(transactionReq, intake, false)) {
      throw new McpOnboardingError('An application for this clinic and contact already exists.', 409)
    }
    if (staffMode === 'new_account') await requireUnusedClinicStaffEmail(transactionReq, intake.contactEmail)
    const medicalSpecialties = await verifyMainSpecialties(transactionReq, medicalSpecialtyIds)
    const payload = transactionReq.payload
    const application = await payload.create({
      collection: 'clinicApplications',
      data: { ...intake, medicalSpecialties, status: 'submitted' },
      depth: 0,
      overrideAccess: false,
      req: transactionReq,
    })
    const identity = getStagedOnboardingIdentity(application.id)
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        contact: { website: intake.clinicWebsite },
        internalPrimaryContact: {
          firstName: intake.contactFirstName,
          lastName: intake.contactLastName,
          email: intake.contactEmail,
          role: intake.contactRole,
        },
        name: intake.clinicName,
        participationStatus: 'pending',
        slug: `${slugify(intake.clinicName) || 'clinic'}-${randomUUID().slice(0, 8)}`,
        status: 'pending',
      },
      depth: 0,
      overrideAccess: false,
      req: transactionReq,
    })
    await withMcpOnboardingWrite(transactionReq, { clinicId: clinic.id }, () =>
      payload.update({
        collection: 'clinics',
        id: clinic.id,
        data: identity,
        depth: 0,
        overrideAccess: true,
        req: transactionReq,
      }),
    )
    const clinicStaffId =
      selectedStaffId ??
      (
        await payload.create({
          collection: 'clinicStaff',
          data: {
            assignmentScope: 'local',
            authSync: { status: 'pending' },
            clinic: clinic.id,
            email: intake.contactEmail,
            firstName: intake.contactFirstName,
            lastName: intake.contactLastName,
            ...identity,
            status: 'pending',
          },
          depth: 0,
          overrideAccess: true,
          req: transactionReq,
        })
      ).id

    const staged = await withMcpOnboardingWrite(transactionReq, { applicationId: application.id }, () =>
      payload.update({
        collection: 'clinicApplications',
        id: application.id,
        data: {
          linkedRecords: { clinic: clinic.id, clinicStaff: clinicStaffId },
          mcpOnboardingRequestKey: requestKey,
          mcpOnboardingStaffMode: staffMode,
        },
        depth: 0,
        overrideAccess: true,
        req: transactionReq,
      }),
    )
    return readOnboardingStatus(transactionReq, staged)
  }).catch(async (error: unknown) => {
    if (error instanceof McpOnboardingError) throw error

    // A competing transaction can commit the request before a local unique write completes.
    await requireClinicOnboardingOperator(req)
    const existing = await findApplicationByRequestKey(req, requestKey)
    if (!existing) throw error
    return readOnboardingStatus(req, await readStagedApplication(req, existing.id))
  })
}

export async function readClinicOnboarding(req: PayloadRequest, input: { applicationId: number }) {
  await requireCurrentPlatformStaff(req)
  return runClinicRegistrationTransaction(req, async (transactionReq) => {
    const application = await readStagedApplication(transactionReq, input.applicationId)
    return {
      ...(await readOnboardingStatus(transactionReq, application)),
      clinicName: application.clinicName,
      clinicWebsite: application.clinicWebsite,
      medicalSpecialtyIds: application.medicalSpecialties,
      contactFirstName: application.contactFirstName,
      contactLastName: application.contactLastName,
      contactEmail: application.contactEmail,
      contactRole: application.contactRole,
    }
  })
}

export async function correctClinicOnboarding(req: PayloadRequest, input: Correction) {
  return runClinicRegistrationTransaction(req, async (transactionReq) => {
    await requireClinicOnboardingOperator(transactionReq)
    const application = await readStagedApplication(transactionReq, input.applicationId)
    if (application.status !== 'submitted') {
      throw new McpOnboardingError('This clinic onboarding application cannot be corrected.', 409)
    }
    const binding = getStagedOnboardingBinding(application)
    await readBoundStagedClinic(transactionReq, binding)
    const { clinicId, clinicStaffId } = binding
    const { applicationId, medicalSpecialtyIds, clinicStaffId: selectedStaffId, ...details } = input
    const isExistingAccount = application.mcpOnboardingStaffMode === 'existing_account'
    if (isExistingAccount && input.contactEmail !== undefined) {
      throw new McpOnboardingError('Select a staff account by ID to change the existing contact email.', 400)
    }
    if (!isExistingAccount && selectedStaffId !== undefined) {
      throw new McpOnboardingError('This application uses a new staff account.', 400)
    }
    const selection =
      selectedStaffId !== undefined
        ? getSelectedStaffContact(await requireSelectedClinicStaff(transactionReq, selectedStaffId), input)
        : undefined
    const intake = { ...details, ...selection }
    const normalizedContactEmail = intake.contactEmail === undefined ? undefined : normalizeEmail(intake.contactEmail)
    const clinicName = intake.clinicName ?? application.clinicName
    const contactEmail = normalizedContactEmail ?? application.contactEmail
    if (
      (clinicName !== application.clinicName || contactEmail !== application.contactEmail) &&
      (await findDuplicateClinicApplication(transactionReq, { clinicName, contactEmail }, false))
    ) {
      throw new McpOnboardingError('An application for this clinic and contact already exists.', 409)
    }
    if (!isExistingAccount && contactEmail !== application.contactEmail) {
      await requireUnusedClinicStaffEmail(transactionReq, contactEmail, clinicStaffId)
    }
    const medicalSpecialties = medicalSpecialtyIds && (await verifyMainSpecialties(transactionReq, medicalSpecialtyIds))
    const payload = transactionReq.payload
    const contactChanged = ['contactEmail', 'contactFirstName', 'contactLastName', 'contactRole'].some((field) =>
      Object.hasOwn(intake, field),
    )
    const shouldUpdateStaff = ['contactEmail', 'contactFirstName', 'contactLastName'].some((field) =>
      Object.hasOwn(intake, field),
    )
    if (input.clinicName !== undefined || input.clinicWebsite !== undefined || contactChanged) {
      await withMcpOnboardingWrite(transactionReq, { clinicId }, () =>
        payload.update({
          collection: 'clinics',
          id: clinicId,
          data: {
            ...(input.clinicName !== undefined ? { name: input.clinicName } : {}),
            ...(input.clinicWebsite !== undefined ? { contact: { website: input.clinicWebsite } } : {}),
            ...(contactChanged
              ? {
                  internalPrimaryContact: {
                    firstName:
                      intake.contactFirstName === undefined ? application.contactFirstName : intake.contactFirstName,
                    lastName: intake.contactLastName ?? application.contactLastName,
                    email: contactEmail,
                    role: input.contactRole ?? application.contactRole,
                  },
                }
              : {}),
          },
          depth: 0,
          overrideAccess: false,
          req: transactionReq,
        }),
      )
    }

    if (!isExistingAccount && shouldUpdateStaff) {
      await readBoundStagedNewStaff(transactionReq, application, binding, 'pending')
      await withMcpOnboardingWrite(transactionReq, { staffId: clinicStaffId }, () =>
        payload.update({
          collection: 'clinicStaff',
          id: clinicStaffId,
          data: {
            ...(input.contactFirstName !== undefined ? { firstName: input.contactFirstName } : {}),
            ...(input.contactLastName !== undefined ? { lastName: input.contactLastName } : {}),
            ...(normalizedContactEmail !== undefined ? { email: normalizedContactEmail } : {}),
          },
          depth: 0,
          overrideAccess: true,
          req: transactionReq,
        }),
      )
    }

    const updated = await withMcpOnboardingWrite(transactionReq, { applicationId }, () =>
      payload.update({
        collection: 'clinicApplications',
        id: applicationId,
        data: {
          ...intake,
          ...(normalizedContactEmail !== undefined ? { contactEmail: normalizedContactEmail } : {}),
          ...(medicalSpecialties ? { medicalSpecialties } : {}),
        },
        depth: 0,
        overrideAccess: false,
        req: transactionReq,
      }),
    )
    if (selectedStaffId === undefined || selectedStaffId === clinicStaffId) {
      return readOnboardingStatus(transactionReq, {
        ...updated,
        mcpOnboardingStaffMode: application.mcpOnboardingStaffMode,
      })
    }
    const linked = await withMcpOnboardingWrite(transactionReq, { applicationId }, () =>
      payload.update({
        collection: 'clinicApplications',
        id: applicationId,
        data: { linkedRecords: { clinic: clinicId, clinicStaff: selectedStaffId } },
        depth: 0,
        overrideAccess: true,
        req: transactionReq,
      }),
    )
    return readOnboardingStatus(transactionReq, linked)
  })
}
