import type { CollectionBeforeChangeHook } from 'payload'
import {
  buildNestedFilename,
  buildStoragePath,
  extractRelationId,
  getBaseFilename,
  resolveDocumentId,
  sanitizePathSegment,
} from '@/collections/common/mediaPathHelpers'
import { getDoctorClinicId } from '@/access/utils/getDoctorClinic'

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

  let clinicId = extractRelationId(draft.clinic) ?? extractRelationId(originalDoc?.clinic)
  if (!clinicId) {
    clinicId = await getDoctorClinicId(incomingDoctorId, req.payload)
  }

  if (!clinicId) {
    throw new Error('Unable to resolve clinic for doctor media upload')
  }

  draft.clinic = clinicId

  const doctorSegment = sanitizePathSegment(incomingDoctorId)
  const docId = resolveDocumentId({ operation, data: draft, originalDoc, req })
  const filenameSource =
    typeof draft.filename === 'string' ? draft.filename : (originalDoc as any)?.filename ?? undefined
  const baseFilename = getBaseFilename(filenameSource)

  if (!doctorSegment) {
    draft.storagePath = draft.storagePath ?? (originalDoc as any)?.storagePath
    return draft
  }

  if (!docId) {
    if (operation === 'create') {
      throw new Error('Unable to resolve document identifier for doctor media upload')
    }
    draft.storagePath = draft.storagePath ?? (originalDoc as any)?.storagePath
    return draft
  }

  if (!baseFilename) {
    if (operation === 'create') {
      throw new Error('Unable to resolve filename for doctor media upload')
    }
    draft.storagePath = draft.storagePath ?? (originalDoc as any)?.storagePath
    return draft
  }

  const nestedFilename = buildNestedFilename(doctorSegment, docId, baseFilename)
  const storagePath = buildStoragePath('doctors', doctorSegment, docId, baseFilename)

  if (operation === 'create' || typeof draft.filename === 'string') {
    draft.filename = nestedFilename
  }

  draft.storagePath = storagePath

  return draft
}
