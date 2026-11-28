import { BLOG_ARCHIVE_PATHS } from '@/i18n/blogArchivePath'
import { CONTACT_PATHS } from '@/i18n/contactPath'
import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { findPageSitemapDocs } from '@/utilities/content/serverData'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { resolveSitemapIndexingAccessForRequest } from '@/features/searchIndexing/sitemapGuards'
import { getListingComparisonServerData } from '@/utilities/listingComparison/serverData'
import { buildPagePath, buildSitemapTag } from '@/utilities/cachePolicy'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { TEMPORARY_LANDING_PATHS } from '@/features/temporaryLandingMode/i18n'
import { getServerSideURL } from '@/utilities/getURL'

const fixedPublicPaths = [
  '/',
  ...Object.values(BLOG_ARCHIVE_PATHS),
  ...Object.values(CONTACT_PATHS),
  '/about',
  '/listing-comparison',
] as const
const excludedPublicPaths = new Set(['/search'])

type SitemapEntry = {
  lastmod?: string
  loc: string
}

const buildSitemapLocation = (siteUrl: string, path: string): string => {
  const baseUrl = siteUrl.replace(/\/+$/, '')

  return path === '/' ? `${baseUrl}/` : `${baseUrl}${path}`
}

const normalizePageSitemapPath = (slug: string | null | undefined, locale: ContentLocale): string | null => {
  if (!slug) return null

  try {
    const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, '')
    const unprefixedPath = buildPagePath(normalizedSlug)
    return excludedPublicPaths.has(unprefixedPath) ? null : buildPagePath(normalizedSlug, locale)
  } catch {
    return null
  }
}

const getPagesSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://example.com'

    const [germanPages, englishPages, listingComparisonData] = await Promise.all([
      findPageSitemapDocs(payload, 'de'),
      findPageSitemapDocs(payload, 'en'),
      getListingComparisonServerData(payload),
    ])

    const sitemapByPath = new Map<string, SitemapEntry>()

    for (const path of fixedPublicPaths) {
      sitemapByPath.set(path, {
        loc: buildSitemapLocation(SITE_URL, path),
        ...(path === '/listing-comparison' && listingComparisonData.freshness.updatedAt
          ? { lastmod: listingComparisonData.freshness.updatedAt }
          : {}),
      })
    }

    const pages = { de: germanPages, en: englishPages }
    for (const locale of ['de', 'en'] as const) {
      for (const page of pages[locale]) {
        const path = normalizePageSitemapPath(page.slug, locale)
        if (!path) continue

        const existingEntry = sitemapByPath.get(path)
        if (existingEntry) {
          sitemapByPath.set(path, {
            ...existingEntry,
            ...(page.updatedAt ? { lastmod: page.updatedAt } : {}),
          })
          continue
        }

        sitemapByPath.set(path, {
          loc: buildSitemapLocation(SITE_URL, path),
          ...(page.updatedAt ? { lastmod: page.updatedAt } : {}),
        })
      }
    }

    return Array.from(sitemapByPath.values())
  },
  ['pages-sitemap', 'localized'],
  {
    tags: [buildSitemapTag('pages')],
  },
)

export async function GET(request: Request) {
  const access = await resolveSitemapIndexingAccessForRequest(request)

  if (!access.allowed) {
    return getServerSideSitemap([], {
      [SEARCH_ROBOTS_HEADER]: SEARCH_ROBOTS_HEADER_VALUE,
    })
  }

  if (access.temporaryLandingMode) {
    const siteUrl = getServerSideURL()
    return getServerSideSitemap(
      [...Object.values(TEMPORARY_LANDING_PATHS), BLOG_ARCHIVE_PATHS.de].map((path) => ({
        loc: buildSitemapLocation(siteUrl, path),
      })),
    )
  }

  const sitemap = await getPagesSitemap()

  return getServerSideSitemap(sitemap)
}
