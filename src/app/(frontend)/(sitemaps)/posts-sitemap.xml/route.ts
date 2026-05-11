import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { findPostSitemapDocs } from '@/utilities/content/serverData'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { shouldBlockSitemapIndexingForRequest } from '@/features/searchIndexing/sitemapGuards'

const getPostsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://example.com'

    const results = await findPostSitemapDocs(payload)

    const dateFallback = new Date().toISOString()

    const sitemap = results
      .filter((post) => Boolean(post?.slug))
      .map((post) => ({
        loc: `${SITE_URL}/posts/${post?.slug}`,
        lastmod: post.updatedAt || dateFallback,
      }))

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
