import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type FieldAccess,
  type PayloadRequest,
} from 'payload'
import { platformClinicTrustAccess, platformClinicTrustFieldAccess } from '@/access/fieldAccess'
import { getStagedOnboardingApplicationId } from '@/features/clinicOnboarding/stagedIdentity'
import { isTrustedMcpOnboardingClinicWrite } from '@/features/clinicOnboarding/stagedWriteGuards'
import type { Clinic } from '@/payload-types'
import { relationId } from './profileGallery'

const contactFields = ['firstName', 'lastName', 'email', 'role'] as const

async function readLinkedStagedApplication(req: PayloadRequest, clinic: Pick<Clinic, 'id' | 'onboardingKey'>) {
  const applicationId = getStagedOnboardingApplicationId(clinic.onboardingKey)
  if (applicationId === undefined) return null
  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id: applicationId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    select: { mcpOnboardingRequestKey: true, linkedRecords: true, status: true },
    req,
  })
  return application?.mcpOnboardingRequestKey && relationId(application.linkedRecords?.clinic) === clinic.id
    ? application
    : null
}

export const readClinicPrimaryContact: FieldAccess<Clinic> = async (args) => {
  if (!(await platformClinicTrustFieldAccess(args))) return false
  const { doc, id, req } = args
  if (req.payloadAPI !== 'MCP' || id === undefined) return true

  // An MCP projection can omit the internal binding that identifies the staged application.
  const clinic = doc?.onboardingKey
    ? doc
    : await req.payload.findByID({
        collection: 'clinics',
        id,
        depth: 0,
        disableErrors: true,
        overrideAccess: true,
        select: { onboardingKey: true },
        trash: true,
        req,
      })
  return Boolean(clinic && (await readLinkedStagedApplication(req, clinic))?.status !== 'submitted')
}

function blockOpenApplicationDeletion() {
  throw new APIError('A clinic with an open clinic onboarding application cannot be deleted.', 409)
}

export const protectStagedClinicDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    id,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    select: { onboardingKey: true },
    trash: true,
    req,
  })
  if (clinic && (await readLinkedStagedApplication(req, clinic))?.status === 'submitted') blockOpenApplicationDeletion()
}

export const protectStagedClinicLifecycle: CollectionBeforeChangeHook<Clinic> = async ({ data, originalDoc, req }) => {
  if (!originalDoc?.onboardingKey) return data
  const trashing = data.deletedAt != null && data.deletedAt !== originalDoc.deletedAt
  if (!trashing && isTrustedMcpOnboardingClinicWrite(req, originalDoc.id)) return data

  const publicationChanged = data.status !== undefined && data.status !== originalDoc.status
  const nextParticipation = data.participationStatus
  const participationChanged = nextParticipation !== undefined && nextParticipation !== originalDoc.participationStatus
  const contactChanged =
    data.internalPrimaryContact !== undefined &&
    contactFields.some(
      (field) =>
        (data.internalPrimaryContact?.[field] ?? null) !== (originalDoc.internalPrimaryContact?.[field] ?? null),
    )
  if (!trashing && !publicationChanged && !participationChanged && !contactChanged) return data

  const application = await readLinkedStagedApplication(req, originalDoc)
  if (!application) return data
  if (trashing && application.status === 'submitted') blockOpenApplicationDeletion()

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
