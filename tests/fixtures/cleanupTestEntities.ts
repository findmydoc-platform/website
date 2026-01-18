import type { Payload, CollectionSlug, Where } from 'payload'

// Collections we commonly clean up in tests
export type TestCollectionSlug =
  | 'pages'
  | 'posts'
  | 'categories'
  | 'clinics'
  | 'treatments'
  | 'tags'
  | 'doctors'
  | 'cities'
  | 'clinictreatments'

type PrefixQueryableField = 'slug' | 'name'

function getPrefixQueryableField(collection: TestCollectionSlug): PrefixQueryableField | null {
  if (collection === 'cities') return 'name'
  if (collection === 'treatments') return 'name'
  if (collection === 'clinictreatments') return null
  return 'slug'
}

/**
 * Deletes all entities with a test slug prefix from the given collection.
 * Note: Uses `slug` by default, `name` for Cities.
 * For ClinicTreatments, deletes rows by finding Clinics matching the slug prefix.
 * @param payload Payload instance
 * @param collection Collection slug (must support `slug`)
 * @param slugPrefix Slug prefix to match (e.g., "test-foo")
 */
export async function cleanupTestEntities(payload: Payload, collection: TestCollectionSlug, slugPrefix: string) {
  if (collection === 'clinictreatments') {
    const clinics = await payload.find({
      collection: 'clinics',
      where: { slug: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
      depth: 0,
    })

    const clinicIds = clinics.docs.map((doc) => doc.id)
    if (!clinicIds.length) return

    const clinicTreatments = await payload.find({
      collection: 'clinictreatments',
      where: { clinic: { in: clinicIds } },
      limit: 200,
      overrideAccess: true,
      depth: 0,
    })

    for (const doc of clinicTreatments.docs) {
      await payload.delete({ collection: 'clinictreatments', id: doc.id, overrideAccess: true })
    }

    return
  }

  const field = getPrefixQueryableField(collection)
  if (!field) return

  const where: Where =
    field === 'slug' ? { slug: { like: `${slugPrefix}%` } } : { name: { like: `${slugPrefix}%` } }

  const { docs } = await payload.find({
    // Cast to satisfy typed Payload API in tests
    collection: collection as CollectionSlug,
    where,
    limit: 200,
    overrideAccess: true,
    depth: 0,
  })

  for (const doc of docs) {
    await payload.delete({ collection: collection as CollectionSlug, id: doc.id, overrideAccess: true })
  }
}
