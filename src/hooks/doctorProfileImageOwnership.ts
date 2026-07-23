import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'

import { extractRelationId, resolveDocumentId } from '@/collections/common/mediaPathHelpers'
import { DOCTOR_PROFILE_IMAGE_MESSAGES } from '@/collections/doctors/profileImageEligibility'
import type { Doctor, DoctorMedia } from '@/payload-types'

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)

const throwProfileImageValidation = ({
  id,
  message,
  req,
}: {
  id?: number | string
  message: string
  req: PayloadRequest
}): never => {
  throw new ValidationError({
    collection: 'doctors',
    errors: [{ label: 'Profile Image', message, path: 'profileImage' }],
    id,
    req,
  })
}

export const beforeChangeValidateDoctorProfileImage: CollectionBeforeChangeHook<Doctor> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const draft = { ...(data || {}) } as Partial<Doctor>
  const profileImageSubmitted = hasOwn(draft, 'profileImage')
  const clinicSubmitted = hasOwn(draft, 'clinic')
  if (!profileImageSubmitted && !(operation === 'update' && clinicSubmitted)) return draft

  const profileImageId = extractRelationId(profileImageSubmitted ? draft.profileImage : originalDoc?.profileImage)
  if (!profileImageId) return draft

  const doctorId = resolveDocumentId({
    operation,
    data: draft as Record<string, unknown>,
    originalDoc: originalDoc as unknown as Record<string, unknown> | undefined,
    req: req as unknown as Record<string, unknown>,
  })
  if (!doctorId) {
    throwProfileImageValidation({ message: DOCTOR_PROFILE_IMAGE_MESSAGES.doctorMissing, req })
  }

  const doctorClinicId = extractRelationId(draft.clinic) ?? extractRelationId(originalDoc?.clinic)
  if (!doctorClinicId) {
    throwProfileImageValidation({
      id: originalDoc?.id,
      message: DOCTOR_PROFILE_IMAGE_MESSAGES.clinicMissing,
      req,
    })
  }

  const profileImage = await req.payload
    .findByID({
      collection: 'doctorMedia',
      id: profileImageId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    .then((result) => result as DoctorMedia)
    .catch(() =>
      throwProfileImageValidation({
        id: originalDoc?.id,
        message: DOCTOR_PROFILE_IMAGE_MESSAGES.unavailable,
        req,
      }),
    )

  if (extractRelationId(profileImage.doctor) !== String(doctorId)) {
    throwProfileImageValidation({
      id: originalDoc?.id,
      message: DOCTOR_PROFILE_IMAGE_MESSAGES.wrongDoctor,
      req,
    })
  }

  if (extractRelationId(profileImage.clinic) !== String(doctorClinicId)) {
    throwProfileImageValidation({
      id: originalDoc?.id,
      message: DOCTOR_PROFILE_IMAGE_MESSAGES.wrongClinic,
      req,
    })
  }

  return draft
}
