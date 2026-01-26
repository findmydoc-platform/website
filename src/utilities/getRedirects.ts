import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

/**
 * Fetches all redirects from PayloadCMS.
 *
 * @param depth - Relationship population depth (default: 1)
 * @returns Array of redirect documents
 */
export async function getRedirects(depth = 1) {
  const payload = await getPayload({ config: configPromise })

  const { docs: redirects } = await payload.find({
    collection: 'redirects',
    depth,
    limit: 0,
    pagination: false,
  })

  return redirects
}

/**
 * Returns a cached version of getRedirects with Next.js unstable_cache.
 * Caches all redirects together to avoid multiple fetches.
 *
 * @returns Cached function that fetches all redirects
 *
 * @example
 * const getCachedRedirects = getCachedRedirects()
 * const redirects = await getCachedRedirects()
 */
export const getCachedRedirects = () =>
  unstable_cache(async () => getRedirects(), ['redirects'], {
    tags: ['redirects'],
  })
