import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { findPostSitemapDocs } from '@/utilities/content/serverData'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { resolveSitemapIndexingAccessForRequest } from '@/features/searchIndexing/sitemapGuards'
import { buildPostPath, buildSitemapTag } from '@/utilities/cachePolicy'
import { buildEnglishPostCanonicalPath } from '@/utilities/content/postPaths'

const buildSitemapLocation = (siteUrl: string, path: string): string => {
  const baseUrl = siteUrl.replace(/\/+$/, '')

  return `${baseUrl}${path}`
}

const normalizePostSitemapSlug = (slug: string | null | undefined): string | null => {
  if (typeof slug !== 'string') return null

  const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, '')
  try {
    buildPostPath(normalizedSlug)
    return normalizedSlug
  } catch {
    return null
  }
}

const getPostsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://example.com'

    const [de, en] = await Promise.all([findPostSitemapDocs(payload, 'de'), findPostSitemapDocs(payload, 'en')])
    const publishedGermanIds = new Set<number>()
    const germanPaths = new Set<string>()
    return (
      [
        ['de', de],
        ['en', en],
      ] as const
    ).flatMap(([locale, posts]) =>
      posts.flatMap((post) => {
        const slug = normalizePostSitemapSlug(post?.slug)
        if (!slug) return []

        let path = buildPostPath(slug, locale)
        if (locale === 'de') {
          publishedGermanIds.add(post.id)
          germanPaths.add(path)
        } else {
          const legacySlug = normalizePostSitemapSlug(post.legacyEnglishSlug)
          if (legacySlug && !publishedGermanIds.has(post.id) && !germanPaths.has(buildPostPath(legacySlug))) {
            path = buildEnglishPostCanonicalPath(slug, legacySlug)
          }
        }
        return {
          loc: buildSitemapLocation(SITE_URL, path),
          ...(post.updatedAt ? { lastmod: post.updatedAt } : {}),
        }
      }),
    )
  },
  ['posts-sitemap', 'localized-repaired-status'],
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
