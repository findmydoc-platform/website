import type { CollectionBeforeChangeHook } from 'payload'

import { extractRelationId, resolveDocumentId } from '@/collections/common/mediaPathHelpers'
import type { Doctor, DoctorMedia } from '@/payload-types'

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)

export const beforeChangeValidateDoctorProfileImage: CollectionBeforeChangeHook<Doctor> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const draft = { ...(data || {}) } as Partial<Doctor>
  if (!hasOwn(draft, 'profileImage')) return draft

  const profileImageId = extractRelationId(draft.profileImage)
  if (!profileImageId) return draft

  const doctorId = resolveDocumentId({
    operation,
    data: draft as Record<string, unknown>,
    originalDoc: originalDoc as unknown as Record<string, unknown> | undefined,
    req: req as unknown as Record<string, unknown>,
  })
  if (!doctorId) {
    throw new Error('Save the doctor before assigning a profile image')
  }

  const doctorClinicId = extractRelationId(draft.clinic) ?? extractRelationId(originalDoc?.clinic)
  if (!doctorClinicId) {
    throw new Error('Doctor clinic is required before assigning a profile image')
  }

  let profileImage: DoctorMedia
  try {
    profileImage = (await req.payload.findByID({
      collection: 'doctorMedia',
      id: profileImageId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as DoctorMedia
  } catch {
    throw new Error('Selected profile image is unavailable')
  }

  if (extractRelationId(profileImage.doctor) !== String(doctorId)) {
    throw new Error('Selected profile image does not belong to this doctor')
  }

  if (extractRelationId(profileImage.clinic) !== String(doctorClinicId)) {
    throw new Error("Selected profile image does not belong to this doctor's clinic")
  }

  return draft
}
