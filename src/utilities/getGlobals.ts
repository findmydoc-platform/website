import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import { buildCollectionTag, buildGlobalTag } from '@/utilities/cachePolicy'
import type { ContentLocale } from '@/utilities/contentLocalization'

type Global = keyof Config['globals']

// Bump this namespace when a schema or access change can leave unsafe cached documents after deploy.
const GLOBAL_CACHE_NAMESPACE_VERSION = '2026-11-23'

const isNavigationGlobal = (slug: Global) => slug === 'header' || slug === 'footer'
const hasEnglishChromeReferences = (slug: Global) => isNavigationGlobal(slug) || slug === 'cookieConsent'
const hasPostReferences = (slug: Global) => isNavigationGlobal(slug) || slug === 'landingPages'
const hasPageReferences = (slug: Global) => hasPostReferences(slug) || slug === 'cookieConsent'

/**
 * Fetches a global document from PayloadCMS by slug.
 *
 * @param slug - Global document slug
 * @param depth - Relationship population depth (default: 0)
 * @returns Global document data
 */
export async function getGlobal(slug: Global, depth = 0, locale?: ContentLocale) {
  const payload = await getPayload({ config: configPromise })
  const global = await payload.findGlobal({
    slug,
    depth,
    overrideAccess: false,
    ...(locale || hasEnglishChromeReferences(slug) ? { locale: locale ?? 'en', fallbackLocale: false } : {}),
  })

  return global
}

/**
 * Returns a cached version of getGlobal with Next.js unstable_cache.
 * Tags the cache for invalidation when the global or its populated content changes.
 *
 * @param slug - Global document slug
 * @param depth - Relationship population depth (default: 0)
 * @returns Cached function that fetches the global document
 *
 * @example
 * const getCachedSettings = getCachedGlobal('settings')
 * const settings = await getCachedSettings()
 */
export const getCachedGlobal = (slug: Global, depth = 0, locale?: ContentLocale) => {
  const tags = [buildGlobalTag(slug)]
  if (depth > 0 && hasPageReferences(slug)) tags.push(buildCollectionTag('pages'))
  if (depth > 0 && hasPostReferences(slug)) tags.push(buildCollectionTag('posts'))

  const keys = [GLOBAL_CACHE_NAMESPACE_VERSION, slug, String(depth)]
  if (locale) keys.push(locale)
  return unstable_cache(async () => getGlobal(slug, depth, locale), keys, { tags })
}
