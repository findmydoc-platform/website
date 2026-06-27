import { revalidatePath, revalidateTag } from 'next/cache.js'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

export const PLATFORM_CONTENT_MEDIA_LANDING_TAGS = ['global_landingPages', 'pages-sitemap'] as const
export const PLATFORM_CONTENT_MEDIA_LANDING_PATHS = ['/', '/about', '/partners/clinics'] as const

const POSTS_PER_PAGE = 12
const REVALIDATE_SLUG_PAGE_SIZE = 100

type SlugDoc = {
  slug?: unknown
}

const isSlugDoc = (doc: unknown): doc is { slug: string } =>
  Boolean(doc && typeof doc === 'object' && typeof (doc as SlugDoc).slug === 'string')

const revalidateLandingConsumers = (): void => {
  for (const tag of PLATFORM_CONTENT_MEDIA_LANDING_TAGS) {
    revalidateTag(tag, { expire: 0 })
  }

  for (const path of PLATFORM_CONTENT_MEDIA_LANDING_PATHS) {
    revalidatePath(path)
  }
}

async function findPublishedSlugs(req: PayloadRequest, collection: 'pages' | 'posts'): Promise<string[]> {
  const slugs: string[] = []
  let page = 1

  while (true) {
    const result = await req.payload.find({
      collection,
      depth: 0,
      limit: REVALIDATE_SLUG_PAGE_SIZE,
      page,
      pagination: true,
      overrideAccess: true,
      req,
      select: {
        slug: true,
      },
      where: {
        _status: {
          equals: 'published',
        },
      },
    })

    for (const doc of result.docs) {
      if (isSlugDoc(doc) && doc.slug.trim().length > 0) {
        slugs.push(doc.slug)
      }
    }

    if (!result.hasNextPage) {
      return slugs
    }

    page += 1
  }
}

async function revalidatePublishedPages(req: PayloadRequest): Promise<void> {
  const slugs = await findPublishedSlugs(req, 'pages')

  for (const slug of slugs) {
    revalidatePath(slug === 'home' ? '/' : `/${slug}`)
  }
}

async function revalidatePublishedPosts(req: PayloadRequest): Promise<void> {
  const [slugs, countResult] = await Promise.all([
    findPublishedSlugs(req, 'posts'),
    req.payload.count({
      collection: 'posts',
      overrideAccess: true,
      req,
      where: {
        _status: {
          equals: 'published',
        },
      },
    }),
  ])

  for (const slug of slugs) {
    revalidatePath(`/posts/${slug}`)
  }

  revalidatePath('/posts')

  const totalPages = Math.ceil(countResult.totalDocs / POSTS_PER_PAGE)
  for (let page = 2; page <= totalPages; page += 1) {
    revalidatePath(`/posts/page/${page}`)
  }

  revalidateTag('posts-sitemap', { expire: 0 })
}

async function revalidatePlatformContentMediaConsumerCaches(req: PayloadRequest): Promise<void> {
  req.payload.logger.info('Revalidating platform content media consumers')

  revalidateLandingConsumers()
  await revalidatePublishedPages(req)
  await revalidatePublishedPosts(req)
}

export const revalidatePlatformContentMediaConsumers: CollectionAfterChangeHook = ({ doc, req }) => {
  if (req.context.disableRevalidate) return doc

  return revalidatePlatformContentMediaConsumerCaches(req)
    .then(() => doc)
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      req.payload.logger.warn(`Unable to revalidate platform content media consumers: ${message}`)
      return doc
    })
}

export const revalidateDeletedPlatformContentMediaConsumers: CollectionAfterDeleteHook = ({ doc, req }) => {
  if (req.context.disableRevalidate) return doc

  return revalidatePlatformContentMediaConsumerCaches(req)
    .then(() => doc)
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      req.payload.logger.warn(`Unable to revalidate platform content media consumers: ${message}`)
      return doc
    })
}
