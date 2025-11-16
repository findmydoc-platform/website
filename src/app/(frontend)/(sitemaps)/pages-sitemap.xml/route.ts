import { getServerSideSitemap } from 'next-sitemap'
import { unstable_cache } from 'next/cache'
import {
  fetchPublishedDocuments,
  getDateFallback,
  getSiteUrl,
} from '@/utilities/sitemap/sitemapHelpers'

const getPagesSitemap = unstable_cache(
  async () => {
    const SITE_URL = getSiteUrl()

    const results = await fetchPublishedDocuments({
      collection: 'pages',
    })

    const dateFallback = getDateFallback()

    const defaultSitemap = [
      {
        loc: `${SITE_URL}/search`,
        lastmod: dateFallback,
      },
      {
        loc: `${SITE_URL}/posts`,
        lastmod: dateFallback,
      },
    ]

    const sitemap = results.docs
      ? results.docs
          .filter((page) => Boolean(page?.slug))
          .map((page) => {
            return {
              loc: page?.slug === 'home' ? `${SITE_URL}/` : `${SITE_URL}/${page?.slug}`,
              lastmod: page.updatedAt || dateFallback,
            }
          })
      : []

    return [...defaultSitemap, ...sitemap]
  },
  ['pages-sitemap'],
  {
    tags: ['pages-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getPagesSitemap()

  return getServerSideSitemap(sitemap)
}
