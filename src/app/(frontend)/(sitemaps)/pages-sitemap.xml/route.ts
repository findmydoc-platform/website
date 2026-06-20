import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { findPageSitemapDocs } from '@/utilities/content/serverData'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { shouldBlockSitemapIndexingForRequest } from '@/features/searchIndexing/sitemapGuards'

const fixedPublicPaths = new Set(['/search', '/posts', '/contact', '/about'])

const getPagesSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://example.com'

    const results = await findPageSitemapDocs(payload)

    const dateFallback = new Date().toISOString()

    const defaultSitemap = [
      {
        loc: `${SITE_URL}/search`,
        lastmod: dateFallback,
      },
      {
        loc: `${SITE_URL}/posts`,
        lastmod: dateFallback,
      },
      {
        loc: `${SITE_URL}/contact`,
        lastmod: dateFallback,
      },
      {
        loc: `${SITE_URL}/about`,
        lastmod: dateFallback,
      },
    ]

    const sitemap = results
      .filter((page) => Boolean(page?.slug))
      .filter((page) => {
        const path = page?.slug === 'home' ? '/' : `/${page?.slug}`
        return !fixedPublicPaths.has(path)
      })
      .map((page) => {
        return {
          loc: page?.slug === 'home' ? `${SITE_URL}/` : `${SITE_URL}/${page?.slug}`,
          lastmod: page.updatedAt || dateFallback,
        }
      })

    return [...defaultSitemap, ...sitemap]
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
