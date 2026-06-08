import type { CollectionSlug, DataFromCollectionSlug, PayloadRequest } from 'payload'

type InternalFindByIDOptions<TSlug extends CollectionSlug> = {
  collection: TSlug
  depth?: number
  id: number | string
  req: PayloadRequest
}

export async function findInternalByID<TSlug extends CollectionSlug>({
  collection,
  depth = 0,
  id,
  req,
}: InternalFindByIDOptions<TSlug>): Promise<DataFromCollectionSlug<TSlug>> {
  return req.payload.findByID({
    collection,
    id,
    depth,
    overrideAccess: true,
    req,
  })
}
