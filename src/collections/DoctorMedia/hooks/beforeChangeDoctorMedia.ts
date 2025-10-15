import type { CollectionBeforeChangeHook } from 'payload'
import { extractRelationId } from '@/collections/common/mediaPathHelpers'
import { getDoctorClinicId } from '@/access/utils/getDoctorClinic'
import { computeStorage } from '@/hooks/media/computeStorage'

export const beforeChangeDoctorMedia: CollectionBeforeChangeHook<any> = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  const draft: any = { ...(data || {}) }

  const incomingDoctorId = extractRelationId(draft.doctor) ?? extractRelationId(originalDoc?.doctor)
  if (!incomingDoctorId) {
    throw new Error('Doctor is required for doctor media uploads')
  }

  if (operation === 'update' && originalDoc?.doctor) {
    const existingDoctorId = extractRelationId(originalDoc.doctor)
    if (existingDoctorId && existingDoctorId !== incomingDoctorId) {
      throw new Error('Doctor ownership cannot be changed once set')
    }
  }

  if (operation === 'create' && req.user && req.user.collection === 'basicUsers') {
    draft.createdBy = draft.createdBy ?? req.user.id
  }

  draft.doctor = draft.doctor ?? incomingDoctorId

  let clinicId = extractRelationId(draft.clinic) ?? extractRelationId(originalDoc?.clinic)
  if (!clinicId) {
    clinicId = await getDoctorClinicId(incomingDoctorId, req.payload)
  }

  if (!clinicId) {
    throw new Error('Unable to resolve clinic for doctor media upload')
  }

  draft.clinic = clinicId

  const { filename, storagePath } = computeStorage({
    operation,
    draft,
    originalDoc,
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
