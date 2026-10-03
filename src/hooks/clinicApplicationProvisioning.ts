import type { ClinicApplication } from '@/payload-types'
import {
  isClinicOnboardingError,
  provisionClinicOnboarding,
  type ClinicOnboardingErrorCode,
} from '@/features/clinicOnboarding/provisionClinicOnboarding'
import { getCurrentIsoTimestampString } from '@/utilities/timestamps'
import { hasClinicApplicationProvisioningInputChanged } from '@/collections/clinicApplications/provisioningLifecycle'
import type { CollectionAfterChangeHook } from 'payload'
import { requestInitialClinicInvitation } from '@/auth/actions/clinicInvitationRequests'

const updateProvisioningState = async (
  req: Parameters<CollectionAfterChangeHook<ClinicApplication>>[0]['req'],
  applicationId: number | string,
  data: Record<string, unknown>,
) => {
  await req.payload.update({
    collection: 'clinicApplications',
    id: applicationId,
    context: { ...req.context, skipClinicApplicationProvisioning: true },
    data,
    depth: 0,
    overrideAccess: true,
    req,
  })
}

export const provisionApprovedClinicApplication: CollectionAfterChangeHook<ClinicApplication> = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (req.context?.skipClinicApplicationProvisioning) return doc
  if (doc.status !== 'approved') return doc

  const provisioningStatus = doc.provisioningStatus ?? 'not_started'
  if (provisioningStatus !== 'not_started' && provisioningStatus !== 'failed') return doc

  const transitionedToApproved = previousDoc?.status !== 'approved'
  const shouldRetryFailedProvisioning =
    provisioningStatus === 'failed' && previousDoc && hasClinicApplicationProvisioningInputChanged(doc, previousDoc)

  if (!transitionedToApproved && !shouldRetryFailedProvisioning) return doc

  try {
    const result = await provisionClinicOnboarding(
      req.payload,
      {
        onboardingKey: `clinic-application:${doc.id}`,
        clinicName: doc.clinicName,
        website: doc.clinicWebsite,
        contactFirstName: doc.contactFirstName ?? undefined,
        contactLastName: doc.contactLastName,
        contactEmail: doc.contactEmail,
        contactRole: doc.contactRole,
      },
      req,
    )

    await updateProvisioningState(req, doc.id, {
      linkedRecords: {
        clinic: result.clinicId,
        clinicStaff: result.clinicStaffId,
        processedAt: getCurrentIsoTimestampString(),
      },
      provisioningErrorCode: null,
      provisioningStatus: 'completed',
    })
    try {
      await requestInitialClinicInvitation(req, result.clinicStaffId)
    } catch {
      req.payload.logger.error(
        {
          event: 'auth.clinic_invitation_preparation_failed',
          clinicStaffId: result.clinicStaffId,
        },
        'Clinic invitation preparation failed; approval remains unchanged.',
      )
    }
  } catch (error) {
    const errorCode: ClinicOnboardingErrorCode = isClinicOnboardingError(error) ? error.code : 'record_failed'

    req.payload.logger.error(
      {
        applicationId: doc.id,
        err: error instanceof Error ? error : new Error(String(error)),
        errorCode,
        event: 'clinic_onboarding.application_failed',
      },
      'Approved clinic application provisioning failed',
    )

    try {
      await updateProvisioningState(req, doc.id, {
        provisioningErrorCode: errorCode,
        provisioningStatus: 'failed',
      })
    } catch (stateError) {
      req.payload.logger.error(
        {
          applicationId: doc.id,
          err: stateError instanceof Error ? stateError : new Error(String(stateError)),
          event: 'clinic_onboarding.application_failure_state_failed',
        },
        'Clinic application provisioning failure state could not be stored',
      )
    }
  }

  return doc
}
