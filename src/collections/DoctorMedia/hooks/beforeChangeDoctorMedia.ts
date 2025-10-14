import crypto from 'crypto'
import type { CollectionBeforeChangeHook } from 'payload'
import {
  buildNestedFilename,
  buildStoragePath,
  extractRelationId,
  getBaseFilename,
  resolveFilenameSource,
  sanitizePathSegment,
} from '@/collections/common/mediaPathHelpers'
import { getDoctorClinicId } from '@/access/utils/getDoctorClinic'

/**
 * Returns a short deterministic hash used to derive stable storage folder keys.
 */
function shortHash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 10)
}

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
  const filenameSource = resolveFilenameSource({
    req,
    draftFilename: draft?.filename,
    originalFilename: (originalDoc as any)?.filename,
  })
  const baseFilename = getBaseFilename(filenameSource)

  if (!doctorSegment) {
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

  const size = (req as any)?.file?.size ?? (Array.isArray((req as any)?.files) ? (req as any).files[0]?.size : undefined)
  const raw = `${doctorSegment}:${baseFilename}${size ? `:${size}` : ''}`
  const derivedKey = shortHash(raw)
  const nestedFilename = buildNestedFilename(doctorSegment, derivedKey, baseFilename)
  const storagePath = buildStoragePath('doctors', doctorSegment, derivedKey, baseFilename)

  if (operation === 'create' || typeof draft.filename === 'string') {
    draft.filename = nestedFilename
  }

  draft.storagePath = storagePath

  try {
    req?.payload?.logger?.debug?.({
      msg: 'doctor-media:derived-path',
      doctor: doctorSegment,
      clinic: clinicId,
      baseFilename,
      derivedKey,
      nestedFilename,
      storagePath,
      operation,
    })
  } catch (_error) {
    // ignore logging failures
  }

  return draft
}
