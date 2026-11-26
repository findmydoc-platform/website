import { beforeEach, describe, expect, it, vi } from 'vitest'

const cacheMocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  unstableCache: vi.fn((callback: () => unknown) => callback),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: cacheMocks.getPayload,
  }
})

vi.mock('next/cache', () => ({
  unstable_cache: cacheMocks.unstableCache,
}))

import {
  buildPostDetailDataCacheTags,
  buildPostListDataCacheKey,
  getCachedLatestPosts,
  getCachedPostArchivePage,
  getCachedPublicPostRoute,
} from '@/utilities/content/serverData/posts'

describe('posts server data cache contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('versions cached post canonicals by policy, slug, and locale with canonical invalidation tags', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 7, slug: 'hello-world', title: 'Hallo Welt' }] }),
    }
    cacheMocks.getPayload.mockResolvedValue(payload)
    await expect(getCachedPublicPostRoute('hello-world', 'de')).resolves.toMatchObject({
      canonicalPath: '/posts/hello-world',
      post: { id: 7, slug: 'hello-world', title: 'Hallo Welt' },
    })

    expect(buildPostDetailDataCacheTags('hello-world')).toEqual([
      'collection:posts',
      'collection:categories',
      'slug:posts:hello-world',
    ])
    expect(cacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['post-detail-localized-category-titles-reachable-legacy-canonical', 'hello-world', 'de'],
      {
        tags: ['collection:posts', 'collection:categories', 'slug:posts:hello-world'],
      },
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        draft: false,
        fallbackLocale: false,
        locale: 'de',
        overrideAccess: false,
        where: {
          and: [{ _status: { equals: 'published' } }, { slug: { equals: 'hello-world' } }],
        },
      }),
    )
  })

  it('keeps the English canonical when the legacy alias cannot be looked up verbatim', async () => {
    const post = { id: 7, slug: 'english-post', title: 'Fixture title', legacyEnglishSlug: 'former ' }
    cacheMocks.getPayload.mockResolvedValue({
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [post] })
        .mockResolvedValue({ docs: [] }),
    })

    await expect(getCachedPublicPostRoute('english-post', 'en')).resolves.toMatchObject({
      canonicalPath: '/en/posts/english-post',
      post,
    })
  })

  it.each(['foo:bar', 'foo bar', 'foo/bar', ''])(
    'treats invalid public route slug %j as a missing post',
    async (slug) => {
      await expect(getCachedPublicPostRoute(slug, 'de')).resolves.toBeNull()

      expect(cacheMocks.unstableCache).not.toHaveBeenCalled()
      expect(cacheMocks.getPayload).not.toHaveBeenCalled()
    },
  )

  it('uses canonical aggregated-public tags for latest post teaser reads', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 1, slug: 'latest-post' }],
      }),
    }
    cacheMocks.getPayload.mockResolvedValue(payload)

    await expect(getCachedLatestPosts(3)).resolves.toEqual([{ id: 1, slug: 'latest-post' }])

    expect(cacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['posts-latest', buildPostListDataCacheKey({ contentLocale: {}, limit: 3, page: 1 })],
      {
        tags: [
          'collection:posts',
          'collection:categories',
          'surface:posts-list',
          'surface:home',
          'surface:partners-clinics',
          'surface:sitemap:posts',
        ],
      },
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        draft: false,
        overrideAccess: false,
        pagination: false,
      }),
    )
  })

  it('couples latest post locale query options to the cache key', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 3, slug: 'deutscher-beitrag' }] }),
    }
    cacheMocks.getPayload.mockResolvedValue(payload)

    await getCachedLatestPosts(3, { locale: 'de', fallbackLocale: 'en' })

    expect(cacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      [
        'posts-latest',
        buildPostListDataCacheKey({
          contentLocale: { locale: 'de', fallbackLocale: 'en' },
          limit: 3,
          page: 1,
        }),
      ],
      expect.any(Object),
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackLocale: false,
        locale: 'de',
      }),
    )
  })

  it.each([
    { locale: 'de', preferred: { title: 'Nachsorge', lang: 'de' }, fallback: { title: 'Recovery', lang: 'en' } },
    { locale: 'en', preferred: { title: 'Aftercare', lang: 'en' }, fallback: { title: 'Vorbereitung', lang: 'de' } },
  ] as const)(
    'chooses category titles for $locale archive cards without falling back on the post',
    async ({ locale, preferred, fallback }) => {
      const fallbackId = locale === 'de' ? 10 : 11
      const posts = [
        { id: 1, slug: 'preferred-category', publishedAt: '2026-01-02', updatedAt: '2026-01-02', categories: [9] },
        {
          id: 2,
          slug: 'fallback-category',
          publishedAt: '2026-01-01',
          updatedAt: '2026-01-01',
          categories: [fallbackId],
        },
      ]
      const categories = [
        { id: 9, title: { de: 'Nachsorge', en: 'Aftercare' } },
        { id: 10, title: { en: 'Recovery' } },
        { id: 11, title: { de: 'Vorbereitung' } },
      ]
      const payload = {
        find: vi.fn(async (query: { collection: string; locale: string }) => {
          if (query.collection === 'categories') return { docs: categories }
          return { docs: query.locale === locale ? posts : [] }
        }),
      }
      cacheMocks.getPayload.mockResolvedValue(payload)

      await expect(getCachedPostArchivePage({ preferredLocale: locale })).resolves.toMatchObject({
        docs: [
          { locale, post: { id: 1, categories: [9], categoryLabel: preferred } },
          { locale, post: { id: 2, categories: [fallbackId], categoryLabel: fallback } },
        ],
      })
      expect(payload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'posts',
          locale,
          overrideAccess: false,
          fallbackLocale: false,
        }),
      )
      expect(payload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'categories',
          locale: 'all',
          fallbackLocale: false,
          overrideAccess: false,
          where: { id: { in: [9, fallbackId] } },
        }),
      )
      expect(cacheMocks.unstableCache).toHaveBeenCalledWith(
        expect.any(Function),
        ['post-archive-cards'],
        expect.objectContaining({
          tags: expect.arrayContaining(['collection:posts', 'collection:categories', 'surface:posts-list']),
        }),
      )
    },
  )
})
