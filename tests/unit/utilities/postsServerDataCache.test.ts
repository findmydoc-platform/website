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
  buildPostListDataCacheKey,
  buildPostListDataCacheTags,
  getCachedLatestPosts,
  getCachedPublishedPostsPage,
} from '@/utilities/content/serverData/posts'

describe('posts server data cache contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
        fallbackLocale: 'en',
        locale: 'de',
      }),
    )
  })

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
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
      'surface:sitemap:posts',
    ])
    expect(
      buildPostListDataCacheKey({ contentLocale: { locale: 'de', fallbackLocale: 'en' }, limit: 12, page: 2 }),
    ).toBe(
      JSON.stringify({
        version: '2026-07-08',
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
        fallbackLocale: 'en',
        locale: 'de',
        overrideAccess: false,
      }),
    )
  })
})
