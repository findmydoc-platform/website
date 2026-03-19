import type { Payload, Where } from 'payload'

import type { Page, PagesSelect } from '@/payload-types'

import { mergePublishedWhere, type PagedResult } from './shared'

export type PageDetailDoc = Pick<Page, 'id' | 'title' | 'slug' | 'layout' | 'publishedAt' | 'meta'>
export type PageSlugDoc = Pick<Page, 'id' | 'slug'>
export type PageSitemapDoc = Pick<Page, 'id' | 'slug' | 'updatedAt'>

export type FindPublishedPagesArgs = {
  depth?: number
  draft?: boolean
  limit?: number
  page?: number
  pagination?: boolean
  sort?: string
  where?: Where
}

const PAGE_DETAIL_SELECT = {
  title: true,
  slug: true,
  layout: true,
  publishedAt: true,
  meta: {
    title: true,
    image: true,
    description: true,
  },
} satisfies PagesSelect<true>

const PAGE_SLUG_SELECT = {
  slug: true,
} satisfies PagesSelect<true>

const PAGE_SITEMAP_SELECT = {
  slug: true,
  updatedAt: true,
} satisfies PagesSelect<true>

async function queryPages<TDoc>(
  payload: Payload,
  {
    depth = 0,
    draft = false,
    limit = 10,
    page,
    pagination = true,
    sort,
    where,
    select = PAGE_DETAIL_SELECT,
  }: FindPublishedPagesArgs & { select?: PagesSelect<true> } = {},
): Promise<PagedResult<TDoc>> {
  const result = await payload.find({
    collection: 'pages',
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

export async function findPageBySlug(payload: Payload, slug: string, draft = false): Promise<PageDetailDoc | null> {
  const result = await queryPages<PageDetailDoc>(payload, {
    depth: 0,
    draft,
    limit: 1,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
    select: PAGE_DETAIL_SELECT,
  })

  return result.docs[0] ?? null
}

export async function findPageSlugs(payload: Payload): Promise<PageSlugDoc[]> {
  const result = await queryPages<PageSlugDoc>(payload, {
    depth: 0,
    limit: 1000,
    pagination: false,
    select: PAGE_SLUG_SELECT,
  })

  return result.docs
}

export async function findPageSitemapDocs(payload: Payload): Promise<PageSitemapDoc[]> {
  const result = await queryPages<PageSitemapDoc>(payload, {
    depth: 0,
    limit: 1000,
    pagination: false,
    select: PAGE_SITEMAP_SELECT,
  })

  return result.docs
}

export { PAGE_DETAIL_SELECT, PAGE_SITEMAP_SELECT, PAGE_SLUG_SELECT }
