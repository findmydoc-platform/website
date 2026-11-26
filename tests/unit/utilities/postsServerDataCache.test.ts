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
  buildPostListDataCacheTags,
  getCachedLatestPosts,
  getCachedPublicPostRoute,
  getCachedPublishedPostsPage,
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
      ['post-detail-localized-category-titles', 'hello-world', 'de'],
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
    'chooses category titles for $locale without falling back on the post',
    async ({ locale, preferred, fallback }) => {
      const fallbackId = locale === 'de' ? 10 : 11
      const payload = {
        find: vi
          .fn()
          .mockResolvedValueOnce({
            docs: [
              { id: 1, categories: [9] },
              { id: 2, categories: [fallbackId] },
            ],
          })
          .mockResolvedValueOnce({
            docs: [
              { id: 9, title: { de: 'Nachsorge', en: 'Aftercare' } },
              { id: 10, title: { en: 'Recovery' } },
              { id: 11, title: { de: 'Vorbereitung' } },
            ],
          }),
      }
      cacheMocks.getPayload.mockResolvedValue(payload)

      await expect(getCachedPublishedPostsPage({ contentLocale: { locale } })).resolves.toMatchObject({
        docs: [
          { id: 1, categories: [9], categoryLabel: preferred },
          { id: 2, categories: [fallbackId], categoryLabel: fallback },
        ],
      })
      expect(payload.find).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          collection: 'posts',
          locale,
          fallbackLocale: false,
        }),
      )
      expect(payload.find).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          collection: 'categories',
          locale: 'all',
          fallbackLocale: false,
          overrideAccess: false,
          where: { id: { in: [9, fallbackId] } },
        }),
      )
    },
  )

  it('keys public post list cache entries from stable public inputs only', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 2, slug: 'page-2-post' }],
        totalDocs: 24,
        totalPages: 2,
        page: 2,
      }),
    }
    cacheMocks.getPayload.mockResolvedValue(payload)

    await expect(
      getCachedPublishedPostsPage({
        contentLocale: {
          locale: 'de',
          fallbackLocale: 'en',
        },
        limit: 12,
        page: 2,
      }),
    ).resolves.toMatchObject({
      docs: [{ id: 2, slug: 'page-2-post' }],
      totalDocs: 24,
      totalPages: 2,
      page: 2,
    })

    expect(buildPostListDataCacheTags()).toEqual([
      'collection:posts',
      'collection:categories',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
      'surface:sitemap:posts',
    ])
    expect(
      buildPostListDataCacheKey({ contentLocale: { locale: 'de', fallbackLocale: 'en' }, limit: 12, page: 2 }),
    ).toBe(
      JSON.stringify({
        version: 'localized-category-titles',
        locale: 'de',
        fallbackLocale: 'en',
        limit: 12,
        page: 2,
      }),
    )
    expect(cacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      [
        'posts-list-page',
        buildPostListDataCacheKey({ contentLocale: { locale: 'de', fallbackLocale: 'en' }, limit: 12, page: 2 }),
      ],
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
        fallbackLocale: false,
        locale: 'de',
        overrideAccess: false,
      }),
    )
  })
})
