import type { CollectionBeforeDeleteHook } from 'payload'
import { APIError } from 'payload'

export const beforeDeleteRejectReferencedClinicMedia: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const references = await req.payload.find({
    collection: 'clinics',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    trash: true,
    where: {
      or: [{ profileGallery: { contains: id } }, { thumbnail: { equals: id } }],
    },
  })

  if (references.docs.length > 0) {
    throw new APIError('Remove this image from the clinic profile gallery before deleting it.', 409)
  }
}
