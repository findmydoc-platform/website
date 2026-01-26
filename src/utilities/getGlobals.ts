import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

type Global = keyof Config['globals']

/**
 * Fetches a global document from PayloadCMS by slug.
 *
 * @param slug - Global document slug
 * @param depth - Relationship population depth (default: 0)
 * @returns Global document data
 */
export async function getGlobal(slug: Global, depth = 0) {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

/**
 * Returns a cached version of getGlobal with Next.js unstable_cache.
 * Automatically tags the cache for invalidation when the global changes.
 *
 * @param slug - Global document slug
 * @param depth - Relationship population depth (default: 0)
 * @returns Cached function that fetches the global document
 *
 * @example
 * const getCachedSettings = getCachedGlobal('settings')
 * const settings = await getCachedSettings()
 */
export const getCachedGlobal = (slug: Global, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [slug], {
    tags: [`global_${slug}`],
  })
