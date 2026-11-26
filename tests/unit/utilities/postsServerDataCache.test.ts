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

    expect(buildPostDetailDataCacheTags('hello-world')).toEqual(['collection:posts', 'slug:posts:hello-world'])
    expect(cacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['post-detail-reachable-legacy-canonical', 'hello-world', 'de'],
      {
        tags: ['collection:posts', 'slug:posts:hello-world'],
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
})
