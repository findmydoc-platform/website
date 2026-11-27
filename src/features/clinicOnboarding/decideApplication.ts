import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { requestInitialClinicInvitation } from '@/auth/actions/clinicInvitationRequests'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import {
  clinicStaffAuthorizationKey,
  lockNotificationAuthorization,
  notificationClinicAuthorizationKey,
} from '@/features/clinicNotifications/authorizationBarrier'
import { runClinicRegistrationTransaction } from '@/features/clinicRegistration/transactions'
import type { ClinicApplication } from '@/payload-types'
import { getCurrentIsoTimestampString } from '@/utilities/timestamps'
import {
  ClinicOnboardingError,
  isClinicOnboardingError,
  prepareClinicOnboardingIdentity,
} from './provisionClinicOnboarding'
import {
  McpOnboardingError,
  readOnboardingStatus,
  readStagedApplication,
  requireClinicOnboardingOperator,
} from './stagedApplication'
import { withMcpOnboardingWrite } from './stagedWriteGuards'

type Decision = { outcome: 'approved' } | { outcome: 'rejected'; reason: string }
type Binding = { clinicId: number; clinicStaffId: number; onboardingKey: string; provisioningIdentity: string }
type OnboardingStatus = Awaited<ReturnType<typeof readOnboardingStatus>>
type DecisionMode = {
  validatePendingBinding: (
    req: PayloadRequest,
    application: ClinicApplication,
    binding: Binding,
    decision: Decision,
  ) => Promise<unknown>
  approveParticipation: (req: PayloadRequest, application: ClinicApplication, binding: Binding) => Promise<void>
  afterApproval: (
    req: PayloadRequest,
    application: ClinicApplication,
  ) => Promise<OnboardingStatus & { invitationStatus: string }>
}

function getBinding(application: ClinicApplication): Binding {
  const { clinic, clinicStaff } = application.linkedRecords ?? {}
  if (typeof clinic !== 'number' || typeof clinicStaff !== 'number') {
    throw new McpOnboardingError('The clinic onboarding records are incomplete.', 409)
  }
  const onboardingKey = `clinic-application:${application.id}`
  return {
    clinicId: clinic,
    clinicStaffId: clinicStaff,
    onboardingKey,
    provisioningIdentity: createHash('sha256').update(onboardingKey).digest('hex'),
  }
}

async function readBoundClinic(req: PayloadRequest, binding: Binding) {
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    id: binding.clinicId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  })
  if (
    !clinic ||
    clinic.onboardingKey !== binding.onboardingKey ||
    clinic.provisioningIdentity !== binding.provisioningIdentity
  ) {
    throw new ClinicOnboardingError('record_failed', 'The staged clinic binding has changed.')
  }
  return clinic
}

async function readBoundNewStaff(
  req: PayloadRequest,
  application: ClinicApplication,
  binding: Binding,
  status: 'pending' | 'approved',
) {
  const staff = await req.payload.findByID({
    collection: 'clinicStaff',
    id: binding.clinicStaffId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  })
  if (
    !staff ||
    staff.onboardingKey !== binding.onboardingKey ||
    staff.provisioningIdentity !== binding.provisioningIdentity ||
    staff.assignmentScope !== 'local' ||
    staff.clinic !== binding.clinicId ||
    staff.group != null ||
    staff.status !== status ||
    normalizeEmail(staff.email) !== normalizeEmail(application.contactEmail) ||
    (status === 'pending' && (staff.authSync?.status !== 'pending' || staff.supabaseUserId))
  ) {
    throw new ClinicOnboardingError('record_failed', 'The staged first staff binding has changed.')
  }
  return staff
}

async function approveNewAccountParticipation(req: PayloadRequest, _application: ClinicApplication, binding: Binding) {
  await withMcpOnboardingWrite(req, { staffId: binding.clinicStaffId }, () =>
    req.payload.update({
      collection: 'clinicStaff',
      id: binding.clinicStaffId,
      data: { status: 'approved' },
      context: { skipClinicStaffAuthSync: true },
      depth: 0,
      overrideAccess: false,
      req,
    }),
  )
}

async function persistDecision(req: PayloadRequest, applicationId: number, decision: Decision) {
  return runClinicRegistrationTransaction(req, async (transactionReq) => {
    await requireClinicOnboardingOperator(transactionReq)
    const application = await readStagedApplication(transactionReq, applicationId)
    if (application.status === 'approved' && decision.outcome === 'approved') return application
    if (application.status !== 'submitted') {
      throw new McpOnboardingError('This clinic onboarding application is already decided.', 409)
    }

    const binding = getBinding(application)
    const clinic = await readBoundClinic(transactionReq, binding)
    if (clinic.status !== 'pending' || clinic.participationStatus !== 'pending') {
      throw new McpOnboardingError('The staged clinic is no longer awaiting a decision.', 409)
    }

    const mode = resolveDecisionMode(application)
    await mode.validatePendingBinding(transactionReq, application, binding, decision)

    const { payload } = transactionReq
    await withMcpOnboardingWrite(transactionReq, { clinicId: clinic.id }, () =>
      payload.update({
        collection: 'clinics',
        id: clinic.id,
        data: { participationStatus: decision.outcome },
        depth: 0,
        overrideAccess: false,
        req: transactionReq,
      }),
    )
    if (decision.outcome === 'approved') await mode.approveParticipation(transactionReq, application, binding)

    await withMcpOnboardingWrite(transactionReq, { applicationId }, () =>
      payload.update({
        collection: 'clinicApplications',
        id: applicationId,
        data: {
          status: decision.outcome,
          ...(decision.outcome === 'rejected' ? { reviewNotes: decision.reason } : {}),
        },
        depth: 0,
        overrideAccess: false,
        req: transactionReq,
      }),
    )
    return readStagedApplication(transactionReq, applicationId)
  })
}

async function completeNewAccountSetup(req: PayloadRequest, applicationId: number) {
  return runClinicRegistrationTransaction(req, async (transactionReq) => {
    await requireClinicOnboardingOperator(transactionReq)
    const application = await readStagedApplication(transactionReq, applicationId)
    if (application.provisioningStatus === 'completed') return application

    const binding = getBinding(application)
    await lockNotificationAuthorization(transactionReq, [
      notificationClinicAuthorizationKey(binding.clinicId),
      clinicStaffAuthorizationKey(binding.clinicStaffId),
    ])
    const clinic = await readBoundClinic(transactionReq, binding)
    if (clinic.participationStatus !== 'approved' || clinic.status === 'rejected') {
      throw new McpOnboardingError('The clinic no longer has approved participation.', 409)
    }
    const staff = await readBoundNewStaff(transactionReq, application, binding, 'approved')
    await prepareClinicOnboardingIdentity(
      transactionReq.payload,
      {
        onboardingKey: binding.onboardingKey,
        contactEmail: normalizeEmail(application.contactEmail),
        contactFirstName: application.contactFirstName ?? undefined,
        contactLastName: application.contactLastName,
      },
      staff,
      transactionReq,
    )
    return withMcpOnboardingWrite(transactionReq, { applicationId }, () =>
      transactionReq.payload.update({
        collection: 'clinicApplications',
        id: applicationId,
        data: {
          linkedRecords: {
            clinic: binding.clinicId,
            clinicStaff: binding.clinicStaffId,
            processedAt: getCurrentIsoTimestampString(),
          },
          provisioningErrorCode: null,
          provisioningStatus: 'completed',
        },
        depth: 0,
        overrideAccess: true,
        req: transactionReq,
      }),
    )
  }).catch(async (error: unknown) => {
    if (error instanceof McpOnboardingError) throw error
    const provisioningErrorCode = isClinicOnboardingError(error) ? error.code : 'record_failed'
    req.payload.logger.error(
      { applicationId, provisioningErrorCode, event: 'clinic_onboarding.application_failed' },
      'Approved clinic application provisioning failed',
    )
    return runClinicRegistrationTransaction(req, async (transactionReq) => {
      await requireClinicOnboardingOperator(transactionReq)
      const application = await readStagedApplication(transactionReq, applicationId)
      if (application.provisioningStatus === 'completed') return application
      return withMcpOnboardingWrite(transactionReq, { applicationId }, () =>
        transactionReq.payload.update({
          collection: 'clinicApplications',
          id: applicationId,
          data: { provisioningErrorCode, provisioningStatus: 'failed' },
          depth: 0,
          overrideAccess: true,
          req: transactionReq,
        }),
      )
    })
  })
}

async function prepareNewAccountInvitation(req: PayloadRequest, clinicStaffId: number) {
  try {
    return await requestInitialClinicInvitation(req, clinicStaffId)
  } catch {
    req.payload.logger.error(
      { clinicStaffId, event: 'auth.clinic_invitation_preparation_failed' },
      'Clinic invitation preparation failed; approval remains unchanged.',
    )
    return 'failed' as const
  }
}

const decisionModes: Partial<Record<NonNullable<ClinicApplication['mcpOnboardingStaffMode']>, DecisionMode>> = {
  new_account: {
    validatePendingBinding: (req, application, binding) => readBoundNewStaff(req, application, binding, 'pending'),
    approveParticipation: approveNewAccountParticipation,
    afterApproval: async (req, approved) => {
      const application = await completeNewAccountSetup(req, approved.id)
      const status = await readOnboardingStatus(req, application)
      const invitationStatus =
        status.accountSetupStatus === 'completed'
          ? await prepareNewAccountInvitation(req, status.clinicStaffId)
          : 'not_started'
      return { ...status, invitationStatus }
    },
  },
}

function resolveDecisionMode(application: ClinicApplication): DecisionMode {
  const mode = application.mcpOnboardingStaffMode && decisionModes[application.mcpOnboardingStaffMode]
  if (!mode) throw new McpOnboardingError('This clinic onboarding account mode is unavailable.', 409)
  return mode
}

export async function approveClinicOnboarding(req: PayloadRequest, { applicationId }: { applicationId: number }) {
  const approved = await persistDecision(req, applicationId, { outcome: 'approved' })
  return resolveDecisionMode(approved).afterApproval(req, approved)
}

export async function rejectClinicOnboarding(
  req: PayloadRequest,
  { applicationId, reason }: { applicationId: number; reason: string },
) {
  const application = await persistDecision(req, applicationId, { outcome: 'rejected', reason })
  return { ...(await readOnboardingStatus(req, application)), invitationStatus: 'not_started' }
}
