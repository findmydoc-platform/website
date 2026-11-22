import type { Payload, Where } from 'payload'

import type { Page, PagesSelect } from '@/payload-types'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { buildPagePath } from '@/utilities/cachePolicy'

import { mergePublishedWhere, type LocalizedDocQuery, type PagedResult } from './shared'

export type PageDetailDoc = Pick<Page, 'id' | 'title' | 'slug' | 'layout' | 'publishedAt' | 'updatedAt' | 'meta'>
export type PageSlugDoc = Pick<Page, 'id' | 'slug'>
export type PageSitemapDoc = Pick<Page, 'id' | 'slug' | 'updatedAt'>

export type PublicPageRoute = {
  page: PageDetailDoc
  locale: ContentLocale
  canonicalPath: string
  languagePaths?: Record<ContentLocale | 'x-default', string>
}

export type FindPublishedPagesArgs = {
  contentLocale?: LocalizedDocQuery
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
  updatedAt: true,
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
    contentLocale,
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
    locale: contentLocale?.locale ?? 'de',
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

export async function findPageBySlug(
  payload: Payload,
  slug: string,
  draft = false,
  contentLocale: LocalizedDocQuery = {},
): Promise<PageDetailDoc | null> {
  const result = await queryPages<PageDetailDoc>(payload, {
    contentLocale,
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

async function findPublicPage<TDoc>(payload: Payload, locale: ContentLocale, where: Where, select: PagesSelect<true>) {
  const result = await queryPages<TDoc>(payload, {
    contentLocale: { locale, fallbackLocale: false },
    limit: 1,
    pagination: false,
    where,
    select,
  })
  return result.docs[0] ?? null
}

export async function findPublicPageRoute(
  payload: Payload,
  slug: string,
  locale: ContentLocale,
): Promise<PublicPageRoute | null> {
  const page = await findPageBySlug(payload, slug, false, { locale })
  if (!page?.slug) {
    if (locale === 'en') return null

    const legacyPage = await findPublicPage<PageDetailDoc>(
      payload,
      'en',
      { legacyEnglishSlug: { equals: slug } },
      PAGE_DETAIL_SELECT,
    )
    if (!legacyPage?.slug) return null

    return { page: legacyPage, locale: 'en', canonicalPath: buildPagePath(legacyPage.slug, 'en') }
  }

  const alternateLocale = locale === 'de' ? 'en' : 'de'
  const alternate = await findPublicPage<PageSlugDoc>(
    payload,
    alternateLocale,
    { id: { equals: page.id } },
    PAGE_SLUG_SELECT,
  )
  const canonicalPath = buildPagePath(page.slug, locale)
  if (!alternate?.slug) return { page, locale, canonicalPath }

  const alternatePath = buildPagePath(alternate.slug, alternateLocale)
  const de = locale === 'de' ? canonicalPath : alternatePath
  const en = locale === 'en' ? canonicalPath : alternatePath
  return { page, locale, canonicalPath, languagePaths: { de, en, 'x-default': de } }
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

export async function findPageSitemapDocs(payload: Payload, locale: ContentLocale = 'de'): Promise<PageSitemapDoc[]> {
  const result = await queryPages<PageSitemapDoc>(payload, {
    contentLocale: { locale, fallbackLocale: false },
    depth: 0,
    limit: 1000,
    pagination: false,
    select: PAGE_SITEMAP_SELECT,
  })

  return result.docs
}

export { PAGE_DETAIL_SELECT, PAGE_SITEMAP_SELECT, PAGE_SLUG_SELECT }
