import { APIError, type CollectionBeforeDeleteHook } from 'payload'

export const beforeDeleteRejectReferencedDoctorMedia: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const references = await req.payload.find({
    collection: 'doctors',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    trash: true,
    where: { profileImage: { equals: id } },
  })
  if (references.docs.length > 0)
    throw new APIError('Remove this image from the doctor profile before deleting it.', 409)
}
