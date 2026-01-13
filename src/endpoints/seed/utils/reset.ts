import type { CollectionSlug, Payload } from 'payload'

const demoResetOrder: CollectionSlug[] = [
  'reviews',
  'favoriteclinics',
  'doctortreatments',
  'doctorspecialties',
  'clinictreatments',
  'doctors',
  'clinics',
  'posts',
]

const baselineResetOrder: CollectionSlug[] = [
  'treatments',
  'categories',
  'tags',
  'accreditation',
  'medical-specialties',
  'cities',
  'countries',
]

async function deleteCollection(payload: Payload, collection: CollectionSlug) {
  const batchSize = 5
  let hasDocs = true

  while (hasDocs) {
    const result = await payload.find({
      collection,
      limit: 1000,
      overrideAccess: true,
    })

    if (result.docs.length === 0) {
      hasDocs = false
      continue
    }

    for (let i = 0; i < result.docs.length; i += batchSize) {
      const batch = result.docs.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (doc) => {
          await payload.delete({
            collection,
            id: doc.id,
            overrideAccess: true,
            context: { disableRevalidate: true },
          })
        }),
      )
    }
  }
}

export async function resetCollections(payload: Payload, kind: 'baseline' | 'demo') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Reset is disabled in production')
  }

  const order = kind === 'demo' ? demoResetOrder : baselineResetOrder
  for (const collection of order) {
    payload.logger.info(`Resetting ${collection} (${kind})`)
    await deleteCollection(payload, collection)
  }
}
