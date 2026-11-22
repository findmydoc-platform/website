import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { findPostSitemapDocs } from '@/utilities/content/serverData'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { resolveSitemapIndexingAccessForRequest } from '@/features/searchIndexing/sitemapGuards'
import { buildPostPath, buildSitemapTag } from '@/utilities/cachePolicy'

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

    const [de, en] = await Promise.all([findPostSitemapDocs(payload, 'de'), findPostSitemapDocs(payload, 'en')])
    const postsByLocale = { de, en }
    return (['de', 'en'] as const).flatMap((locale) =>
      postsByLocale[locale].flatMap((post) => {
        const slug = normalizePostSitemapSlug(post?.slug)
        if (!slug) return []

        try {
          return {
            loc: buildSitemapLocation(SITE_URL, buildPostPath(slug, locale)),
            ...(post.updatedAt ? { lastmod: post.updatedAt } : {}),
          }
        } catch {
          return []
        }
      }),
    )
  },
  ['posts-sitemap', 'localized'],
  {
    tags: [buildSitemapTag('posts')],
  },
)

export async function GET(request: Request) {
  const access = await resolveSitemapIndexingAccessForRequest(request)

  if (!access.allowed) {
    return getServerSideSitemap([], {
      [SEARCH_ROBOTS_HEADER]: SEARCH_ROBOTS_HEADER_VALUE,
    })
  }

  const sitemap = await getPostsSitemap()

  return getServerSideSitemap(sitemap)
}
