import { getServerSideSitemap } from 'next-sitemap'
import { unstable_cache } from 'next/cache'
import {
  fetchPublishedDocuments,
  getDateFallback,
  getSiteUrl,
} from '@/utilities/sitemap/sitemapHelpers'

const getPostsSitemap = unstable_cache(
  async () => {
    const SITE_URL = getSiteUrl()

    const results = await fetchPublishedDocuments({
      collection: 'posts',
    })

    const dateFallback = getDateFallback()

    const sitemap = results.docs
      ? results.docs
          .filter((post) => Boolean(post?.slug))
          .map((post) => ({
            loc: `${SITE_URL}/posts/${post?.slug}`,
            lastmod: post.updatedAt || dateFallback,
          }))
      : []

    return sitemap
  },
  ['posts-sitemap'],
  {
    tags: ['posts-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getPostsSitemap()

  return getServerSideSitemap(sitemap)
}
