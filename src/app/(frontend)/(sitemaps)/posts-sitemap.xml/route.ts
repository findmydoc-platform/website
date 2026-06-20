import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { findPostSitemapDocs } from '@/utilities/content/serverData'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { shouldBlockSitemapIndexingForRequest } from '@/features/searchIndexing/sitemapGuards'

const buildSitemapLocation = (siteUrl: string, path: string): string => {
  const baseUrl = siteUrl.replace(/\/+$/, '')

  return `${baseUrl}${path}`
}

const normalizePostSitemapSlug = (slug: string | null | undefined): string | null => {
  if (typeof slug !== 'string') return null

  const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, '')
  if (normalizedSlug.length === 0 || normalizedSlug.includes('/')) return null

  return normalizedSlug
}

const getPostsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://example.com'

    const results = await findPostSitemapDocs(payload)

    const dateFallback = new Date().toISOString()

    const sitemap = results.flatMap((post) => {
      const slug = normalizePostSitemapSlug(post?.slug)
      if (!slug) return []

      return {
        loc: buildSitemapLocation(SITE_URL, `/posts/${slug}`),
        lastmod: post.updatedAt || dateFallback,
      }
    })

    return sitemap
  },
  ['posts-sitemap'],
  {
    tags: ['posts-sitemap'],
  },
)

export async function GET(request: Request) {
  if (await shouldBlockSitemapIndexingForRequest(request)) {
    return getServerSideSitemap([], {
      [SEARCH_ROBOTS_HEADER]: SEARCH_ROBOTS_HEADER_VALUE,
    })
  }

  const sitemap = await getPostsSitemap()

  return getServerSideSitemap(sitemap)
}
