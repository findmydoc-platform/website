import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook } from 'payload'
import { clinicGalleryConstraints } from '@/features/clinicDashboard/gallery/contracts'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { relationId } from '@/collections/clinics/profileGallery'
import { authorizeClinicGalleryTarget } from '@/features/clinicDashboard/gallery/authorization'

export const authorizeClinicMediaWrite: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const stored = relationId(originalDoc?.clinic)
  const incoming = relationId(data?.clinic)
  const explicit = req.context?.clinicGalleryTargetId
  const local =
    stored === null && incoming === null && typeof explicit !== 'string' && req.user?.collection === 'clinicStaff'
      ? await readClinicAccessState(req.payload, req.user.id, req)
      : null
  const target = stored ?? incoming ?? (typeof explicit === 'string' ? explicit : (local?.clinic.id ?? null))
  if (target === null) throw new APIError('A clinic media owner is required.', 400)
  await authorizeClinicGalleryTarget(req, target, true)
  if (incoming !== null && String(incoming) !== String(target))
    throw new APIError('Clinic ownership cannot be changed once set.', 403)
  if (operation === 'create' && req.context?.clinicGalleryUpload === true) {
    const drafts = await req.payload.count({
      collection: 'clinicMedia',
      overrideAccess: true,
      req,
      where: { and: [{ clinic: { equals: target } }, { status: { equals: 'draft' } }] },
    })
    if (drafts.totalDocs >= clinicGalleryConstraints.maxItems)
      throw new APIError('Too many unfinished clinic gallery uploads.', 422)
  }
  return { ...data, clinic: target }
}

export const authorizeClinicMediaDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const original = await req.payload.findByID({
    collection: 'clinicMedia',
    id,
    depth: 0,
    overrideAccess: true,
    trash: true,
    req,
  })
  const clinicId = relationId(original.clinic)
  if (clinicId === null) throw new APIError('Media access denied.', 403)
  await authorizeClinicGalleryTarget(req, clinicId, true)
  const cleanupTarget = req.context?.clinicGalleryCleanupTarget
  if (typeof cleanupTarget === 'string') {
    const current = await req.payload.findByID({
      collection: 'clinicMedia',
      id,
      depth: 0,
      overrideAccess: true,
      trash: true,
      req,
    })
    if (String(clinicId) !== cleanupTarget || current.status !== 'draft')
      throw new APIError('Media cleanup is no longer allowed.', 409)
  }
}
