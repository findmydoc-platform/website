import type { Payload, Where } from 'payload'

import type { Post, PostsSelect } from '@/payload-types'

import { mergePublishedWhere, type PaginatedResult, type PagedResult } from './shared'

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
  | 'heroImage'
  | 'meta'
>

export type PostLatestDoc = PostSummaryDoc & Pick<Post, 'content'>

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
    | 'heroImage'
    | 'relatedPosts'
    | 'meta'
  >,
  'relatedPosts'
> & {
  relatedPosts?: Array<number | PostSummaryDoc> | null
}

export type PostSlugDoc = Pick<Post, 'id' | 'slug'>
export type PostSitemapDoc = Pick<Post, 'id' | 'slug' | 'updatedAt'>

export type FindPublishedPostsArgs = {
  depth?: number
  draft?: boolean
  limit?: number
  page?: number
  pagination?: boolean
  sort?: string
  where?: Where
}

const POST_LIST_SELECT = {
  title: true,
  slug: true,
  excerpt: true,
  categories: true,
  authors: true,
  populatedAuthors: true,
  publishedAt: true,
  heroImage: true,
  meta: {
    image: true,
    description: true,
  },
} satisfies PostsSelect<true>

const POST_LATEST_SELECT = {
  ...POST_LIST_SELECT,
  content: true,
} satisfies PostsSelect<true>

const POST_RELATED_SELECT = {
  title: true,
  slug: true,
  excerpt: true,
  categories: true,
  authors: true,
  populatedAuthors: true,
  publishedAt: true,
  heroImage: true,
  meta: {
    image: true,
    description: true,
  },
} satisfies PostsSelect<true>

const POST_DETAIL_SELECT = {
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  categories: true,
  authors: true,
  populatedAuthors: true,
  publishedAt: true,
  heroImage: true,
  relatedPosts: true,
  meta: {
    title: true,
    image: true,
    description: true,
  },
} satisfies PostsSelect<true>

const POST_SLUG_SELECT = {
  slug: true,
} satisfies PostsSelect<true>

const POST_SITEMAP_SELECT = {
  slug: true,
  updatedAt: true,
} satisfies PostsSelect<true>

type RelatedPostValue = number | { id?: number | null } | null | undefined

const getRelatedPostId = (value: RelatedPostValue): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof value.id === 'number') return value.id

  return null
}

async function hydrateRelatedPostCards(payload: Payload, post: PostDetailDoc, draft: boolean): Promise<PostDetailDoc> {
  const relatedPosts = post.relatedPosts

  if (!Array.isArray(relatedPosts) || relatedPosts.length === 0) {
    return post
  }

  const relatedIds = relatedPosts.map(getRelatedPostId).filter((id): id is number => id !== null)

  if (relatedIds.length === 0) {
    return post
  }

  const relatedResult = await queryPosts<PostSummaryDoc>(payload, {
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

export async function findLatestPosts(payload: Payload, limit = 3): Promise<PostLatestDoc[]> {
  const result = await queryPosts<PostLatestDoc>(payload, {
    depth: 1,
    limit,
    pagination: false,
    sort: '-publishedAt',
    select: POST_LATEST_SELECT,
  })

  return result.docs
}

export async function findPublishedPostsPage(
  payload: Payload,
  { depth = 1, draft = false, limit = 12, page = 1, pagination = true, sort, where }: FindPublishedPostsArgs = {},
): Promise<PaginatedResult<PostSummaryDoc>> {
  const result = await queryPosts<PostSummaryDoc>(payload, {
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

export async function findPostBySlug(payload: Payload, slug: string, draft = false): Promise<PostDetailDoc | null> {
  const result = await queryPosts<PostDetailDoc>(payload, {
    depth: 2,
    draft,
    limit: 1,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
    select: POST_DETAIL_SELECT,
  })

  const post = result.docs[0] ?? null

  if (!post) {
    return null
  }

  return hydrateRelatedPostCards(payload, post, draft)
}

export async function findPostSlugs(payload: Payload): Promise<PostSlugDoc[]> {
  const result = await queryPosts<PostSlugDoc>(payload, {
    depth: 0,
    limit: 1000,
    pagination: false,
    select: POST_SLUG_SELECT,
  })

  return result.docs
}

export async function findPostSitemapDocs(payload: Payload): Promise<PostSitemapDoc[]> {
  const result = await queryPosts<PostSitemapDoc>(payload, {
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
    overrideAccess: false,
    where: mergePublishedWhere(where),
  })

  return result.totalDocs
}

export { POST_DETAIL_SELECT, POST_LATEST_SELECT, POST_LIST_SELECT, POST_SITEMAP_SELECT, POST_SLUG_SELECT }
