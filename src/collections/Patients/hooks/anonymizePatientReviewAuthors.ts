import type { CollectionBeforeDeleteHook } from 'payload'

export const anonymizePatientReviewAuthorsBeforeDeleteHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req
  let page = 1

  while (true) {
    const reviews = await payload.find({
      collection: 'reviews',
      where: {
        patient: {
          equals: id,
        },
      },
      depth: 0,
      limit: 100,
      page,
      overrideAccess: true,
      req,
    })

    for (const review of reviews.docs) {
      await payload.update({
        collection: 'reviews',
        id: review.id,
        data: {
          authorVisibility: 'anonymous',
          publicAuthorName: null,
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
    }

    if (!reviews.hasNextPage) break
    page += 1
  }
}
