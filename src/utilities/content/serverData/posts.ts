import type { Payload, Where } from 'payload'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import type { Post, PostsSelect } from '@/payload-types'
import type { ContentLocale } from '@/utilities/contentLocalization'
import {
  buildCollectionTag,
  buildPostPath,
  buildSitemapTag,
  buildSlugTag,
  buildSurfaceTag,
} from '@/utilities/cachePolicy'
import { buildEnglishPostCanonicalPath } from '@/utilities/content/postPaths'

import { mergePublishedWhere, type LocalizedDocQuery, type PaginatedResult, type PagedResult } from './shared'

export type PostSummaryDoc = Pick<
  Post,
  | 'id'
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'categories'
  | 'authors'
  | 'populatedAuthors'
  | 'publishedAt'
  | 'updatedAt'
  | 'heroImage'
  | 'meta'
>

export type PostLatestDoc = PostSummaryDoc

export type PostDetailDoc = Omit<
  Pick<
    Post,
    | 'id'
    | 'title'
    | 'slug'
    | 'excerpt'
    | 'content'
    | 'categories'
    | 'authors'
    | 'populatedAuthors'
    | 'publishedAt'
    | 'updatedAt'
    | 'heroImage'
    | 'relatedPosts'
    | 'legacyEnglishSlug'
    | 'meta'
  >,
  'relatedPosts'
> & {
  relatedPosts?: Array<number | PostSummaryDoc> | null
}

export type PostSitemapDoc = Pick<Post, 'id' | 'slug' | 'legacyEnglishSlug' | 'updatedAt'>

export type PublicPostRoute = {
  post: PostDetailDoc
  locale: ContentLocale
  canonicalPath: string
  languagePaths?: Record<ContentLocale | 'x-default', string>
}

export type FindPublishedPostsArgs = {
  contentLocale?: LocalizedDocQuery
  depth?: number
  draft?: boolean
  limit?: number
  page?: number
  pagination?: boolean
  sort?: string
  where?: Where
}

export type CachedPublishedPostsPageArgs = {
  contentLocale?: LocalizedDocQuery
  limit?: number
  page?: number
}

const POST_LIST_SELECT = {
  title: true,
  slug: true,
  excerpt: true,
  categories: true,
  authors: true,
  populatedAuthors: true,
  publishedAt: true,
  updatedAt: true,
  heroImage: true,
  meta: {
    image: true,
    description: true,
  },
} satisfies PostsSelect<true>

const POST_LATEST_SELECT = POST_LIST_SELECT

const POST_RELATED_SELECT = {
  title: true,
  slug: true,
  excerpt: true,
  categories: true,
  authors: true,
  populatedAuthors: true,
  publishedAt: true,
  updatedAt: true,
  heroImage: true,
  meta: {
    image: true,
    description: true,
  },
} satisfies PostsSelect<true>

const POST_DETAIL_SELECT = {
  title: true,
  slug: true,
  legacyEnglishSlug: true,
  excerpt: true,
  content: true,
  categories: true,
  authors: true,
  populatedAuthors: true,
  publishedAt: true,
  updatedAt: true,
  heroImage: true,
  relatedPosts: true,
  meta: {
    title: true,
    image: true,
    description: true,
  },
} satisfies PostsSelect<true>

const POST_SITEMAP_SELECT = {
  slug: true,
  legacyEnglishSlug: true,
  updatedAt: true,
} satisfies PostsSelect<true>

const POSTS_LIST_DATA_CACHE_KEY_VERSION = 'localized-publication'

export const buildPostListDataCacheTags = (): string[] => [
  buildCollectionTag('posts'),
  buildSurfaceTag('posts-list'),
  buildSurfaceTag('home'),
  buildSurfaceTag('partners-clinics'),
  buildSitemapTag('posts'),
]

export const buildPostListDataCacheKey = ({
  contentLocale,
  limit = 12,
  page = 1,
}: CachedPublishedPostsPageArgs = {}): string =>
  JSON.stringify({
    version: POSTS_LIST_DATA_CACHE_KEY_VERSION,
    locale: contentLocale?.locale ?? null,
    fallbackLocale: contentLocale?.fallbackLocale ?? null,
    limit,
    page,
  })

export const buildPostDetailDataCacheTags = (slug: string): string[] => [
  buildCollectionTag('posts'),
  buildSlugTag('posts', slug),
]

const isValidPublicPostSlug = (slug: string): boolean => {
  try {
    buildPostPath(slug)
    return true
  } catch {
    return false
  }
}

type RelatedPostValue = number | { id?: number | null } | null | undefined

const getRelatedPostId = (value: RelatedPostValue): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof value.id === 'number') return value.id

  return null
}

async function hydrateRelatedPostCards(
  payload: Payload,
  post: PostDetailDoc,
  draft: boolean,
  contentLocale: LocalizedDocQuery,
): Promise<PostDetailDoc> {
  const relatedPosts = post.relatedPosts

  if (!Array.isArray(relatedPosts) || relatedPosts.length === 0) {
    return post
  }

  const relatedIds = relatedPosts.map(getRelatedPostId).filter((id): id is number => id !== null)

  if (relatedIds.length === 0) {
    return post
  }

  const relatedResult = await queryPosts<PostSummaryDoc>(payload, {
    contentLocale,
    depth: 1,
    draft,
    limit: relatedIds.length,
    pagination: false,
    where: {
      id: {
        in: relatedIds,
      },
    },
    select: POST_RELATED_SELECT,
  })

  const relatedMap = new Map(relatedResult.docs.map((doc) => [Number(doc.id), doc]))

  const hydratedRelatedPosts = relatedPosts.reduce<Array<number | PostSummaryDoc>>((acc, value) => {
    const relatedId = getRelatedPostId(value)

    if (relatedId === null) {
      if (typeof value === 'object') {
        acc.push(value)
      }
      return acc
    }

    const hydratedPost = relatedMap.get(relatedId)
    if (hydratedPost) {
      acc.push(hydratedPost)
      return acc
    }

    if (typeof value === 'object') {
      acc.push(value)
    }

    return acc
  }, [])

  return {
    ...post,
    relatedPosts: hydratedRelatedPosts,
  }
}

async function queryPosts<TDoc>(
  payload: Payload,
  {
    contentLocale,
    depth = 1,
    draft = false,
    limit = 10,
    page,
    pagination = true,
    sort,
    where,
    select = POST_LIST_SELECT,
  }: FindPublishedPostsArgs & { select?: PostsSelect<true> } = {},
): Promise<PagedResult<TDoc>> {
  const result = await payload.find({
    collection: 'posts',
    depth,
    draft,
    locale: contentLocale?.locale ?? 'en',
    fallbackLocale: draft ? (contentLocale?.fallbackLocale ?? false) : false,
    limit,
    page,
    pagination,
    overrideAccess: draft,
    sort,
    where: mergePublishedWhere(where, draft),
    select,
  })

  return result as unknown as PagedResult<TDoc>
}

export async function findLatestPosts(
  payload: Payload,
  limit = 3,
  contentLocale: LocalizedDocQuery = {},
): Promise<PostLatestDoc[]> {
  const result = await queryPosts<PostLatestDoc>(payload, {
    contentLocale,
    depth: 1,
    limit,
    pagination: false,
    sort: '-publishedAt',
    select: POST_LATEST_SELECT,
  })

  return result.docs
}

const getCachedLatestPostsByArgs = (limit: number, contentLocale: LocalizedDocQuery) =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })

      return findLatestPosts(payload, limit, contentLocale)
    },
    [
      'posts-latest',
      buildPostListDataCacheKey({
        contentLocale,
        limit,
        page: 1,
      }),
    ],
    {
      tags: buildPostListDataCacheTags(),
    },
  )

export async function getCachedLatestPosts(limit = 3, contentLocale: LocalizedDocQuery = {}): Promise<PostLatestDoc[]> {
  return getCachedLatestPostsByArgs(limit, contentLocale)()
}

export async function findPublishedPostsPage(
  payload: Payload,
  {
    contentLocale,
    depth = 1,
    draft = false,
    limit = 12,
    page = 1,
    pagination = true,
    sort,
    where,
  }: FindPublishedPostsArgs = {},
): Promise<PaginatedResult<PostSummaryDoc>> {
  const result = await queryPosts<PostSummaryDoc>(payload, {
    contentLocale,
    depth,
    draft,
    limit,
    page,
    pagination,
    sort,
    where,
  })

  return result as unknown as PaginatedResult<PostSummaryDoc>
}

const getCachedPublishedPostsPageByArgs = (args: CachedPublishedPostsPageArgs = {}) =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })

      return findPublishedPostsPage(payload, {
        contentLocale: args.contentLocale,
        limit: args.limit ?? 12,
        page: args.page ?? 1,
      })
    },
    ['posts-list-page', buildPostListDataCacheKey(args)],
    {
      tags: buildPostListDataCacheTags(),
    },
  )

export async function getCachedPublishedPostsPage(
  args: CachedPublishedPostsPageArgs = {},
): Promise<PaginatedResult<PostSummaryDoc>> {
  return getCachedPublishedPostsPageByArgs(args)()
}

export async function findPostBySlug(
  payload: Payload,
  slug: string,
  draft = false,
  contentLocale: LocalizedDocQuery = { locale: 'de' },
): Promise<PostDetailDoc | null> {
  return findPostDetail(payload, { slug: { equals: slug } }, draft, contentLocale)
}

async function findPostDetail(
  payload: Payload,
  where: Where,
  draft: boolean,
  contentLocale: LocalizedDocQuery,
): Promise<PostDetailDoc | null> {
  const result = await queryPosts<PostDetailDoc>(payload, {
    contentLocale,
    depth: 1,
    draft,
    limit: 1,
    pagination: false,
    where,
    select: POST_DETAIL_SELECT,
  })

  const post = result.docs[0] ?? null

  if (!post) {
    return null
  }

  return hydrateRelatedPostCards(payload, post, draft, contentLocale)
}

async function findPublishedPostSlug(payload: Payload, where: Where, locale: ContentLocale) {
  const result = await queryPosts<Pick<Post, 'slug'>>(payload, {
    contentLocale: { locale },
    depth: 0,
    limit: 1,
    pagination: false,
    where,
    select: { slug: true },
  })
  return result.docs[0]?.slug
}

export async function findPublicPostRoute(
  payload: Payload,
  slug: string,
  locale: ContentLocale,
): Promise<PublicPostRoute | null> {
  if (!isValidPublicPostSlug(slug)) return null

  let post = await findPostBySlug(payload, slug, false, { locale })
  if (!post?.slug && locale === 'de') {
    const legacyPost = await findPostDetail(payload, { legacyEnglishSlug: { equals: slug } }, false, { locale: 'en' })
    if (!legacyPost?.slug || !isValidPublicPostSlug(legacyPost.slug)) return null

    const germanSlug = await findPublishedPostSlug(payload, { id: { equals: legacyPost.id } }, 'de')
    if (!germanSlug || !isValidPublicPostSlug(germanSlug)) {
      return { post: legacyPost, locale: 'en', canonicalPath: buildEnglishPostCanonicalPath(legacyPost.slug, slug) }
    }

    post = await findPostBySlug(payload, germanSlug, false, { locale: 'de' })
  }
  if (!post?.slug) return null

  const canonicalPath = buildPostPath(post.slug, locale)
  const alternateLocale = locale === 'de' ? 'en' : 'de'
  const alternateSlug = await findPublishedPostSlug(payload, { id: { equals: post.id } }, alternateLocale)
  if (!alternateSlug || !isValidPublicPostSlug(alternateSlug)) {
    const legacySlug = post.legacyEnglishSlug
    if (locale === 'en' && legacySlug && isValidPublicPostSlug(legacySlug)) {
      const occupied = await findPublishedPostSlug(payload, { slug: { equals: legacySlug } }, 'de')
      if (!occupied) return { post, locale, canonicalPath: buildEnglishPostCanonicalPath(post.slug, legacySlug) }
    }
    return { post, locale, canonicalPath }
  }

  const alternatePath = buildPostPath(alternateSlug, alternateLocale)
  const de = locale === 'de' ? canonicalPath : alternatePath
  const en = locale === 'en' ? canonicalPath : alternatePath
  return { post, locale, canonicalPath, languagePaths: { de, en, 'x-default': de } }
}

export async function getCachedPublicPostRoute(slug: string, locale: ContentLocale): Promise<PublicPostRoute | null> {
  if (!isValidPublicPostSlug(slug)) return null
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })

      return findPublicPostRoute(payload, slug, locale)
    },
    ['post-detail-localized-canonical-transition', slug, locale],
    { tags: buildPostDetailDataCacheTags(slug) },
  )()
}

export async function findPostSitemapDocs(payload: Payload, locale: ContentLocale = 'de'): Promise<PostSitemapDoc[]> {
  const result = await queryPosts<PostSitemapDoc>(payload, {
    contentLocale: { locale },
    depth: 0,
    limit: 1000,
    pagination: false,
    select: POST_SITEMAP_SELECT,
  })

  return result.docs
}

export async function countPublishedPosts(payload: Payload, where?: Where): Promise<number> {
  const result = await payload.count({
    collection: 'posts',
    locale: 'en',
    overrideAccess: false,
    where: mergePublishedWhere(where),
  })

  return result.totalDocs
}

export { POST_DETAIL_SELECT, POST_LATEST_SELECT, POST_LIST_SELECT, POST_SITEMAP_SELECT }
