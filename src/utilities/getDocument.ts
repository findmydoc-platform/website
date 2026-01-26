import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

type Collection = keyof Config['collections']

/**
 * Fetches a document from PayloadCMS by collection and slug.
 *
 * @param collection - PayloadCMS collection name
 * @param slug - Document slug to search for
 * @param depth - Relationship population depth (default: 0)
 * @returns First matching document or undefined if not found
 */
async function getDocument(collection: Collection, slug: string, depth = 0) {
  const payload = await getPayload({ config: configPromise })

  const page = await payload.find({
    collection,
    depth,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return page.docs[0]
}

/**
 * Returns a cached version of getDocument with Next.js unstable_cache.
 * Automatically tags the cache for invalidation when the document changes.
 *
 * @param collection - PayloadCMS collection name
 * @param slug - Document slug to search for
 * @returns Cached function that fetches the document
 *
 * @example
 * const getCachedPage = getCachedDocument('pages', 'about')
 * const pageDoc = await getCachedPage()
 */
export const getCachedDocument = (collection: Collection, slug: string) =>
  unstable_cache(async () => getDocument(collection, slug), [collection, slug], {
    tags: [`${collection}_${slug}`],
  })
