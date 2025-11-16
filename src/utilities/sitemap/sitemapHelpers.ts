import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Shared utility for fetching sitemap data from Payload collections
 */

type SitemapCollectionSlug = 'pages' | 'posts'

interface SitemapQueryOptions {
  collection: SitemapCollectionSlug
  limit?: number
}

interface SitemapDocument {
  slug?: string
  updatedAt?: string
}

export const getSiteUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    'https://example.com'
  )
}

export const fetchPublishedDocuments = async ({
  collection,
  limit = 1000,
}: SitemapQueryOptions): Promise<{ docs: SitemapDocument[] }> => {
  const payload = await getPayload({ config })

  const results = await payload.find({
    collection: collection as any,
    overrideAccess: false,
    draft: false,
    depth: 0,
    limit,
    pagination: false,
    where: {
      _status: {
        equals: 'published',
      },
    },
    select: {
      slug: true,
      updatedAt: true,
    },
  })

  return results as { docs: SitemapDocument[] }
}

export const getDateFallback = (): string => {
  return new Date().toISOString()
}
