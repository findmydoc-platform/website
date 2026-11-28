import type { PayloadRequest } from 'payload'
import { requestInitialClinicInvitation } from '@/auth/actions/clinicInvitationRequests'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import {
  clinicStaffAuthorizationKey,
  lockNotificationAuthorization,
} from '@/features/clinicNotifications/authorizationBarrier'
import type { Clinic, ClinicApplication } from '@/payload-types'
import { getCurrentIsoTimestampString } from '@/utilities/timestamps'
import { writeStagedApplication } from './applicationWrites'
import {
  bindClinicOnboardingSubject,
  isClinicOnboardingError,
  prepareClinicOnboardingSubject,
  type ClinicOnboardingErrorCode,
} from './provisionClinicOnboarding'
import {
  getApplicationRevision,
  getOnboardingClinicGroupId,
  McpOnboardingError,
  readOnboardingStatus,
  readStagedApplication,
  readStagedApplicationForWrite,
  requireClinicOnboardingOperator,
} from './stagedApplication'
import { readEligibleExistingClinicStaff } from './existingStaff'
import { withMcpOnboardingWrite } from './stagedWriteGuards'
import { releaseAbandonedClinicStaffEmail } from './staffEmailReservation'
import { getStagedOnboardingBinding, readBoundStagedClinic, readBoundStagedNewStaff } from './stagedBinding'

type DecisionPrecondition = { applicationId: number; applicationRevision: string }
type Decision = { outcome: 'approved' } | { outcome: 'rejected'; reason: string }

const revisionConflict = () =>
  new McpOnboardingError('The application has changed. Read the latest version before deciding.', 409)

async function persistDecision(
  req: PayloadRequest,
  { applicationId, applicationRevision }: DecisionPrecondition,
  decision: Decision,
) {
  await requireClinicOnboardingOperator(req)
  let reviewedGroupId: number | null = null
  const result = await writeStagedApplication(req, applicationId, {
    prepare: async (transactionReq, skipWrite) => {
      const { application, binding, clinic } = await readStagedApplicationForWrite(transactionReq, applicationId)
      reviewedGroupId = getOnboardingClinicGroupId(clinic)
      if (getApplicationRevision(application, reviewedGroupId) !== applicationRevision) throw revisionConflict()
      if (application.status === 'approved' && decision.outcome === 'approved') return skipWrite(application)
      if (application.status !== 'submitted') {
        throw new McpOnboardingError('This clinic onboarding application is already decided.', 409)
      }
      if (
        clinic.participationStatus !== 'pending' ||
        (decision.outcome === 'approved' && clinic.status === 'rejected')
      ) {
        throw new McpOnboardingError('The staged clinic is no longer awaiting a decision.', 409)
      }

      const { clinicId, clinicStaffId } = binding
      const existingAccount = application.mcpOnboardingStaffMode === 'existing_account'
      if (!existingAccount || decision.outcome === 'approved') {
        await lockNotificationAuthorization(transactionReq, [clinicStaffAuthorizationKey(clinicStaffId)])
      }
      if (!existingAccount) {
        await readBoundStagedNewStaff(transactionReq, application, binding, 'pending')
      } else if (decision.outcome === 'approved') {
        if (!clinic.internalPrimaryContact?.firstName?.trim()) {
          throw new McpOnboardingError('Correct the first contact’s given name before approval.', 409)
        }
        if (!(await readEligibleExistingClinicStaff(transactionReq, { clinicStaffId }))) {
          throw new McpOnboardingError('The selected staff account is unavailable or ineligible.', 409)
        }
      }

      const { payload } = transactionReq
      await withMcpOnboardingWrite(transactionReq, { clinicId }, () =>
        payload.update({
          collection: 'clinics',
          id: clinicId,
          data: { participationStatus: decision.outcome },
          depth: 0,
          overrideAccess: false,
          req: transactionReq,
        }),
      )
      if (decision.outcome === 'rejected') {
        return { data: { status: 'rejected', reviewNotes: decision.reason } }
      }
      if (existingAccount) {
        await replaceClinicStaffAssignment(transactionReq, clinicStaffId, { scope: 'local', clinicId })
        return {
          data: { status: 'approved' },
          workflowData: {
            linkedRecords: {
              clinic: clinicId,
              clinicStaff: clinicStaffId,
              processedAt: getCurrentIsoTimestampString(),
            },
            provisioningStatus: 'completed',
          },
        }
      }
      await withMcpOnboardingWrite(transactionReq, { staffId: clinicStaffId }, () =>
        payload.update({
          collection: 'clinicStaff',
          id: clinicStaffId,
          data: { status: 'approved' },
          context: { skipClinicStaffAuthSync: true },
          depth: 0,
          overrideAccess: false,
          req: transactionReq,
        }),
      )
      return { data: { status: 'approved' } }
    },
    finish: async (transactionReq, doc) => {
      const application = await readStagedApplication(transactionReq, doc.id)
      if (decision.outcome === 'rejected' && application.mcpOnboardingStaffMode === 'new_account') {
        await releaseAbandonedClinicStaffEmail(transactionReq, getStagedOnboardingBinding(application).clinicStaffId)
      }
      return application
    },
  })
  return { application: result, reviewedGroupId }
}

function requireApprovedClinic(clinic: Clinic, reviewedGroupId: number | null) {
  if (clinic.participationStatus !== 'approved' || clinic.status === 'rejected') {
    throw new McpOnboardingError('The clinic no longer has approved participation.', 409)
  }
  if (getOnboardingClinicGroupId(clinic) !== reviewedGroupId) throw revisionConflict()
}

type SetupResult = { subject: string } | { errorCode: ClinicOnboardingErrorCode }

async function persistAccountSetup(
  req: PayloadRequest,
  approved: ClinicApplication,
  reviewedGroupId: number | null,
  result: SetupResult,
) {
  return writeStagedApplication(req, approved.id, {
    prepare: async (transactionReq, skipWrite) => {
      const { application, binding, clinic } = await readStagedApplicationForWrite(transactionReq, approved.id)
      requireApprovedClinic(clinic, reviewedGroupId)
      await lockNotificationAuthorization(transactionReq, [clinicStaffAuthorizationKey(binding.clinicStaffId)])
      if (application.status !== 'approved' || application.mcpOnboardingStaffMode !== 'new_account') {
        throw revisionConflict()
      }
      const staff = await readBoundStagedNewStaff(transactionReq, application, binding, 'approved')
      if (application.provisioningStatus === 'completed') {
        const reviewedBinding = getStagedOnboardingBinding(approved)
        if (
          reviewedBinding.clinicId === binding.clinicId &&
          reviewedBinding.clinicStaffId === binding.clinicStaffId &&
          ('errorCode' in result || result.subject === staff.supabaseUserId)
        )
          return skipWrite(application)
        throw revisionConflict()
      }
      if (getApplicationRevision(approved, reviewedGroupId) !== getApplicationRevision(application, reviewedGroupId)) {
        throw revisionConflict()
      }
      if ('errorCode' in result) {
        return { workflowData: { provisioningErrorCode: result.errorCode, provisioningStatus: 'failed' } }
      }
      if (staff.supabaseUserId && staff.supabaseUserId !== result.subject) throw revisionConflict()
      await bindClinicOnboardingSubject(transactionReq.payload, staff.id, result.subject, transactionReq)
      return {
        workflowData: {
          linkedRecords: {
            clinic: binding.clinicId,
            clinicStaff: binding.clinicStaffId,
            processedAt: getCurrentIsoTimestampString(),
          },
          provisioningErrorCode: null,
          provisioningStatus: 'completed',
        },
      }
    },
    finish: (transactionReq, doc) => readStagedApplication(transactionReq, doc.id),
  })
}

async function completeNewAccountSetup(
  req: PayloadRequest,
  approved: ClinicApplication,
  reviewedGroupId: number | null,
) {
  await requireClinicOnboardingOperator(req)
  const binding = getStagedOnboardingBinding(approved)
  requireApprovedClinic(await readBoundStagedClinic(req, binding), reviewedGroupId)
  const staff = await readBoundStagedNewStaff(req, approved, binding, 'approved')
  if (approved.provisioningStatus === 'completed') return approved

  const recordFailure = (errorCode: ClinicOnboardingErrorCode) => {
    req.payload.logger.error(
      { applicationId: approved.id, provisioningErrorCode: errorCode, event: 'clinic_onboarding.application_failed' },
      'Approved clinic application provisioning failed',
    )
    return persistAccountSetup(req, approved, reviewedGroupId, { errorCode })
  }

  // This provider operation can reconcile a prior creation. The native write below rechecks the approved binding.
  let subject: string
  try {
    subject = await prepareClinicOnboardingSubject(
      req.payload,
      {
        onboardingKey: binding.onboardingKey,
        contactEmail: normalizeEmail(approved.contactEmail),
        contactFirstName: approved.contactFirstName ?? undefined,
        contactLastName: approved.contactLastName,
      },
      staff,
    )
  } catch (error) {
    return recordFailure(isClinicOnboardingError(error) ? error.code : 'auth_failed')
  }
  try {
    return await persistAccountSetup(req, approved, reviewedGroupId, { subject })
  } catch (error) {
    if (!isClinicOnboardingError(error) || error.code !== 'binding_failed') throw error
    return recordFailure(error.code)
  }
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

export async function approveClinicOnboarding(req: PayloadRequest, input: DecisionPrecondition) {
  const { application, reviewedGroupId } = await persistDecision(req, input, { outcome: 'approved' })
  if (application.mcpOnboardingStaffMode !== 'new_account') {
    return { ...(await readOnboardingStatus(req, application)), invitationStatus: 'not_started' }
  }
  const setup = await completeNewAccountSetup(req, application, reviewedGroupId)
  const status = await readOnboardingStatus(req, setup)
  const invitationStatus =
    status.accountSetupStatus === 'completed'
      ? await prepareNewAccountInvitation(req, status.clinicStaffId)
      : 'not_started'
  return { ...status, invitationStatus }
}

export async function rejectClinicOnboarding(
  req: PayloadRequest,
  { reason, ...input }: DecisionPrecondition & { reason: string },
) {
  const { application } = await persistDecision(req, input, { outcome: 'rejected', reason })
  return { ...(await readOnboardingStatus(req, application)), invitationStatus: 'not_started' }
}
