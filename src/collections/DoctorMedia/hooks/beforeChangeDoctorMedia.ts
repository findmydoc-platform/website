import type { CollectionBeforeChangeHook } from 'payload'
import { extractRelationId } from '@/collections/common/mediaPathHelpers'
import { getDoctorClinicId } from '@/access/utils/getDoctorClinic'
import { computeStorage } from '@/hooks/media/computeStorage'
import type { DoctorMedia } from '@/payload-types'

export const beforeChangeDoctorMedia: CollectionBeforeChangeHook<DoctorMedia> = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  const draft = { ...(data || {}) } as Partial<DoctorMedia>

  const incomingDoctorId = extractRelationId(draft.doctor) ?? extractRelationId(originalDoc?.doctor)
  if (!incomingDoctorId) {
    throw new Error('Doctor is required for doctor media uploads')
  }

  const doctorId = Number(incomingDoctorId)
  if (!Number.isFinite(doctorId)) {
    throw new Error('Doctor id must be numeric')
  }

  if (operation === 'update' && originalDoc?.doctor) {
    const existingDoctorId = extractRelationId(originalDoc.doctor)
    if (existingDoctorId && Number(existingDoctorId) !== doctorId) {
      throw new Error('Doctor ownership cannot be changed once set')
    }
  }

  if (operation === 'create' && req.user && req.user.collection === 'basicUsers') {
    draft.createdBy = draft.createdBy ?? req.user.id
  }

  draft.doctor = draft.doctor ?? doctorId

  let clinicId = extractRelationId(draft.clinic) ?? extractRelationId(originalDoc?.clinic)
  if (!clinicId) {
    clinicId = await getDoctorClinicId(doctorId, req.payload)
  }

  const numericClinicId = Number(clinicId)
  if (!clinicId || !Number.isFinite(numericClinicId)) {
    throw new Error('Unable to resolve clinic for doctor media upload')
  }

  draft.clinic = numericClinicId

  const { filename, storagePath } = computeStorage({
    operation,
    draft: draft as unknown as Record<string, unknown>,
    originalDoc: originalDoc as unknown as Record<string, unknown>,
    req,
    ownerField: 'doctor',
    key: { type: 'hash' },
    storagePrefix: 'doctors',
  })

  if (filename !== undefined) {
    draft.filename = filename
  }

  if (storagePath !== undefined) {
    draft.storagePath = storagePath
  }

  return draft
}
