import type { Clinic, ClinicStaff } from '@/payload-types'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import {
  createInitialClinicSupabaseAccount,
  setClinicSupabaseAccountAccess,
  reconcileExistingClinicSupabaseAccount,
} from '@/auth/utilities/supabaseProvision'
import { hashLogValue } from '@/utilities/logging/shared'
import { slugify } from '@/utilities/slugify'
import { createHash, randomUUID } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'

export const CLINIC_ONBOARDING_ERROR_CODES = ['record_failed', 'auth_failed', 'binding_failed'] as const

export type ClinicOnboardingErrorCode = (typeof CLINIC_ONBOARDING_ERROR_CODES)[number]

type ClinicContactRole = NonNullable<NonNullable<Clinic['internalPrimaryContact']>['role']>

export type ClinicOnboardingCommand = {
  onboardingKey: string
  clinicName: string
  website: string
  contactFirstName?: string
  contactLastName: string
  contactEmail: string
  contactRole: ClinicContactRole
}

export type ClinicOnboardingResult = {
  clinicId: number | string
  clinicStaffId: number | string
}

export class ClinicOnboardingError extends Error {
  readonly code: ClinicOnboardingErrorCode

  constructor(code: ClinicOnboardingErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ClinicOnboardingError'
    this.code = code
  }
}

export const isClinicOnboardingError = (error: unknown): error is ClinicOnboardingError =>
  error instanceof ClinicOnboardingError

const readRequiredText = (value: string, field: string): string => {
  const normalized = value.trim()
  if (!normalized) {
    throw new ClinicOnboardingError('record_failed', `${field} is required for clinic onboarding`)
  }
  return normalized
}

const createClinic = async (
  payload: Payload,
  command: ClinicOnboardingCommand,
  req?: PayloadRequest,
): Promise<Clinic> => {
  try {
    return await payload.create({
      collection: 'clinics',
      context: { disableRevalidate: true },
      data: {
        contact: { website: command.website },
        internalPrimaryContact: {
          firstName: command.contactFirstName,
          lastName: command.contactLastName,
          email: command.contactEmail,
          role: command.contactRole,
        },
        name: command.clinicName,
        onboardingKey: command.onboardingKey,
        provisioningIdentity: createHash('sha256').update(command.onboardingKey).digest('hex'),
        participationStatus: 'approved',
        slug: `${slugify(command.clinicName) || 'clinic'}-${randomUUID().slice(0, 8)}`,
        status: 'pending',
      },
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch (error) {
    throw new ClinicOnboardingError('record_failed', 'Clinic record could not be created', {
      cause: error,
    })
  }
}

const createClinicStaff = async (
  payload: Payload,
  command: ClinicOnboardingCommand,
  clinic: Clinic,
  req?: PayloadRequest,
): Promise<ClinicStaff> => {
  try {
    return await payload.create({
      collection: 'clinicStaff',
      context: { skipClinicStaffAuthSync: true },
      data: {
        authSync: { status: 'pending' },
        clinic: clinic.id,
        email: command.contactEmail,
        firstName: command.contactFirstName,
        lastName: command.contactLastName,
        onboardingKey: command.onboardingKey,
        provisioningIdentity: createHash('sha256').update(command.onboardingKey).digest('hex'),
        status: 'approved',
      },
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch (error) {
    throw new ClinicOnboardingError('record_failed', 'Clinic staff record could not be created', {
      cause: error,
    })
  }
}

const findExisting = async (payload: Payload, command: ClinicOnboardingCommand, req?: PayloadRequest) => {
  const [clinics, staff] = await Promise.all([
    payload.find({
      collection: 'clinics',
      depth: 0,
      limit: 2,
      overrideAccess: true,
      req,
      trash: true,
      where: { onboardingKey: { equals: command.onboardingKey } },
    }),
    payload.find({
      collection: 'clinicStaff',
      depth: 0,
      limit: 2,
      overrideAccess: true,
      req,
      where: { onboardingKey: { equals: command.onboardingKey } },
    }),
  ])
  if (clinics.docs.length > 1 || staff.docs.length > 1)
    throw new ClinicOnboardingError('record_failed', 'Ambiguous onboarding records require operator repair')
  const clinic = clinics.docs[0]
  const principal = staff.docs[0]
  if (clinic && (clinic.deletedAt || clinic.status === 'rejected' || clinic.participationStatus !== 'approved')) {
    throw new ClinicOnboardingError('record_failed', 'The clinic is not eligible for provisioning recovery')
  }
  const clinicId = typeof principal?.clinic === 'object' ? principal.clinic?.id : principal?.clinic
  if (
    principal &&
    (!clinic ||
      String(clinicId) !== String(clinic.id) ||
      principal.status !== 'approved' ||
      normalizeEmail(principal.email) !== command.contactEmail)
  ) {
    throw new ClinicOnboardingError(
      'record_failed',
      'The initial participant is not eligible for provisioning recovery',
    )
  }
  return { clinic, principal }
}

const bindSupabaseIdentity = async (
  payload: Payload,
  command: ClinicOnboardingCommand,
  staff: ClinicStaff,
  req?: PayloadRequest,
): Promise<ClinicStaff> => {
  if (staff.supabaseUserId && staff.authSync?.status === 'synced') return staff

  let supabaseUserId = staff.supabaseUserId?.trim()

  try {
    if (supabaseUserId) {
      await setClinicSupabaseAccountAccess({ enabled: true, supabaseUserId }, payload.logger)
    } else if (staff.invitationAttemptedAt) {
      supabaseUserId = await reconcileExistingClinicSupabaseAccount(
        { email: command.contactEmail, onboardingKey: command.onboardingKey },
        payload.logger,
      )
    } else {
      supabaseUserId = await createInitialClinicSupabaseAccount(
        {
          email: command.contactEmail,
          onboardingKey: command.onboardingKey,
          userMetadata: {
            firstName: command.contactFirstName,
            lastName: command.contactLastName,
          },
        },
        payload.logger,
      )
    }
  } catch (error) {
    throw new ClinicOnboardingError('auth_failed', 'Clinic Supabase account could not be provisioned', {
      cause: error,
    })
  }

  try {
    return await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      context: { skipClinicStaffAuthSync: true },
      data: {
        authSync: { errorCode: null, status: 'synced' },
        supabaseUserId,
      },
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch (error) {
    throw new ClinicOnboardingError('binding_failed', 'Supabase identity could not be bound to clinic staff', {
      cause: error,
    })
  }
}

export async function provisionClinicOnboarding(
  payload: Payload,
  input: ClinicOnboardingCommand,
  req?: PayloadRequest,
): Promise<ClinicOnboardingResult> {
  const command: ClinicOnboardingCommand = {
    ...input,
    onboardingKey: readRequiredText(input.onboardingKey, 'onboardingKey'),
    clinicName: readRequiredText(input.clinicName, 'clinicName'),
    website: readRequiredText(input.website, 'website'),
    contactFirstName: input.contactFirstName?.trim() || undefined,
    contactLastName: readRequiredText(input.contactLastName, 'contactLastName'),
    contactEmail: normalizeEmail(input.contactEmail),
  }

  if (!isValidEmail(command.contactEmail)) {
    throw new ClinicOnboardingError('record_failed', 'contactEmail is invalid for clinic onboarding')
  }

  const existing = await findExisting(payload, command, req)
  const clinic = existing.clinic ?? (await createClinic(payload, command, req))
  const staff = existing.principal ?? (await createClinicStaff(payload, command, clinic, req))
  const boundStaff = await bindSupabaseIdentity(payload, command, staff, req)

  payload.logger.info(
    {
      clinicId: clinic.id,
      clinicStaffId: boundStaff.id,
      event: 'clinic_onboarding.completed',
      onboardingKeyHash: hashLogValue(command.onboardingKey),
    },
    'Clinic onboarding provisioning completed',
  )

  return { clinicId: clinic.id, clinicStaffId: boundStaff.id }
}
