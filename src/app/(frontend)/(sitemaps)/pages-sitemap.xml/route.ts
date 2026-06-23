import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { findPageSitemapDocs } from '@/utilities/content/serverData'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { shouldBlockSitemapIndexingForRequest } from '@/features/searchIndexing/sitemapGuards'
import { getListingComparisonServerData } from '@/utilities/listingComparison/serverData'

const fixedPublicPaths = ['/', '/posts', '/contact', '/about', '/listing-comparison'] as const
const excludedPublicPaths = new Set(['/search'])

type SitemapEntry = {
  lastmod?: string
  loc: string
}

const buildSitemapLocation = (siteUrl: string, path: string): string => {
  const baseUrl = siteUrl.replace(/\/+$/, '')

  return path === '/' ? `${baseUrl}/` : `${baseUrl}${path}`
}

const normalizePageSitemapPath = (slug: string | null | undefined): string | null => {
  if (typeof slug !== 'string') return null

  const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, '')
  if (normalizedSlug.length === 0) return null
  if (normalizedSlug === 'home') return '/'

  return `/${normalizedSlug}`
}

const getPagesSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://example.com'

    const [results, listingComparisonData] = await Promise.all([
      findPageSitemapDocs(payload),
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

    for (const page of results) {
      const path = normalizePageSitemapPath(page?.slug)
      if (!path || excludedPublicPaths.has(path)) continue

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

    return Array.from(sitemapByPath.values())
  },
  ['pages-sitemap'],
  {
    tags: ['pages-sitemap'],
  },
)

export async function GET(request: Request) {
  if (await shouldBlockSitemapIndexingForRequest(request)) {
    return getServerSideSitemap([], {
      [SEARCH_ROBOTS_HEADER]: SEARCH_ROBOTS_HEADER_VALUE,
    })
  }

  const sitemap = await getPagesSitemap()

  return getServerSideSitemap(sitemap)
}
