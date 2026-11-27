import { APIError, type CollectionBeforeChangeHook } from 'payload'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import { isTrustedMcpOnboardingClinicWrite } from '@/features/clinicOnboarding/stagedWriteGuards'
import type { Clinic } from '@/payload-types'
import { relationId } from './profileGallery'

const contactFields = ['firstName', 'lastName', 'email', 'role'] as const

export const protectStagedClinicLifecycle: CollectionBeforeChangeHook<Clinic> = async ({ data, originalDoc, req }) => {
  const applicationId = Number(/^clinic-application:([1-9]\d*)$/u.exec(originalDoc?.onboardingKey ?? '')?.[1])
  if (!originalDoc || !Number.isSafeInteger(applicationId)) return data
  if (isTrustedMcpOnboardingClinicWrite(req, originalDoc.id)) return data

  const publicationChanged = data.status !== undefined && data.status !== originalDoc.status
  const nextParticipation = data.participationStatus
  const participationChanged = nextParticipation !== undefined && nextParticipation !== originalDoc.participationStatus
  const contactChanged =
    data.internalPrimaryContact !== undefined &&
    contactFields.some(
      (field) =>
        (data.internalPrimaryContact?.[field] ?? null) !== (originalDoc.internalPrimaryContact?.[field] ?? null),
    )
  if (!publicationChanged && !participationChanged && !contactChanged) return data

  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id: applicationId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    select: { mcpOnboardingRequestKey: true, linkedRecords: true, status: true },
    req,
  })
  if (!application?.mcpOnboardingRequestKey || relationId(application.linkedRecords?.clinic) !== originalDoc.id)
    return data

  if (contactChanged) throw new APIError('Use the clinic onboarding workflow to change the first contact.', 403)
  const adminRestWrite = req.payloadAPI === 'REST' && (await platformClinicTrustAccess({ req })) === true
  if (publicationChanged && !adminRestWrite) {
    throw new APIError('Change the publication status in Payload Admin.', 403)
  }
  if (participationChanged) {
    const previous = originalDoc.participationStatus
    const isSuspensionChange =
      (previous === 'approved' && nextParticipation === 'disabled') ||
      (previous === 'disabled' && nextParticipation === 'approved')
    if (!adminRestWrite || application.status !== 'approved' || !isSuspensionChange) {
      throw new APIError('Use the clinic onboarding workflow to change participation.', 403)
    }
  }
  return data
}
