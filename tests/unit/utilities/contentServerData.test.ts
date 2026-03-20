import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  countPublishedPosts,
  findLatestPosts,
  findPageBySlug,
  findPageSitemapDocs,
  findPageSlugs,
  findPostBySlug,
  findPostSitemapDocs,
  findPostSlugs,
  findPublishedPostsPage,
  POST_DETAIL_SELECT,
  POST_LATEST_SELECT,
  POST_LIST_SELECT,
  POST_SITEMAP_SELECT,
  POST_SLUG_SELECT,
  PAGE_DETAIL_SELECT,
  PAGE_SITEMAP_SELECT,
  PAGE_SLUG_SELECT,
} from '@/utilities/content/serverData'

function createPayloadMock() {
  const findMock = vi.fn()
  const countMock = vi.fn()

  return {
    payload: {
      find: findMock,
      count: countMock,
    } as unknown as Payload,
    findMock,
    countMock,
  }
}

describe('content server data helpers', () => {
  it('reuses the standard post list query shape for latest cards', async () => {
    const { payload, findMock } = createPayloadMock()
    findMock.mockResolvedValue({ docs: [{ id: 1, slug: 'latest-post' }], totalDocs: 1, totalPages: 1 })

    const docs = await findLatestPosts(payload, 3)

    expect(docs).toEqual([{ id: 1, slug: 'latest-post' }])
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        depth: 1,
        draft: false,
        limit: 3,
        pagination: false,
        overrideAccess: false,
        sort: '-publishedAt',
        where: { _status: { equals: 'published' } },
        select: POST_LATEST_SELECT,
      }),
    )
  })

  it('keeps the paginated post archive filter and count semantics intact', async () => {
    const { payload, findMock } = createPayloadMock()
    findMock.mockResolvedValue({
      docs: [{ id: 2, slug: 'page-2' }],
      totalDocs: 24,
      totalPages: 2,
      page: 2,
    })

    const result = await findPublishedPostsPage(payload, {
      limit: 12,
      page: 2,
      where: { categories: { in: [11, 12] } },
    })

    expect(result.docs).toEqual([{ id: 2, slug: 'page-2' }])
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        depth: 1,
        draft: false,
        limit: 12,
        page: 2,
        pagination: true,
        overrideAccess: false,
        where: {
          and: [{ _status: { equals: 'published' } }, { categories: { in: [11, 12] } }],
        },
        select: POST_LIST_SELECT,
      }),
    )
  })

  it('switches the post slug lookup between published and draft mode', async () => {
    const { payload, findMock } = createPayloadMock()
    findMock.mockResolvedValueOnce({ docs: [{ id: 3, slug: 'hello-world' }] })
    findMock.mockResolvedValueOnce({ docs: [{ id: 4, slug: 'draft-post' }] })

    const publishedPost = await findPostBySlug(payload, 'hello-world')
    const draftPost = await findPostBySlug(payload, 'draft-post', true)

    expect(publishedPost).toEqual({ id: 3, slug: 'hello-world' })
    expect(draftPost).toEqual({ id: 4, slug: 'draft-post' })
    expect(findMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'posts',
        depth: 2,
        draft: false,
        limit: 1,
        pagination: false,
        overrideAccess: false,
        where: {
          and: [{ _status: { equals: 'published' } }, { slug: { equals: 'hello-world' } }],
        },
        select: POST_DETAIL_SELECT,
      }),
    )
    expect(findMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'posts',
        depth: 2,
        draft: true,
        limit: 1,
        pagination: false,
        overrideAccess: true,
        where: { slug: { equals: 'draft-post' } },
        select: POST_DETAIL_SELECT,
      }),
    )
  })

  it('exposes dedicated post sitemap and slug queries', async () => {
    const { payload, findMock, countMock } = createPayloadMock()
    findMock.mockResolvedValueOnce({ docs: [{ id: 5, slug: 'sitemap-post', updatedAt: '2026-01-01T00:00:00.000Z' }] })
    findMock.mockResolvedValueOnce({ docs: [{ id: 6, slug: 'archive-post' }] })
    countMock.mockResolvedValue({ totalDocs: 17 })

    const sitemapDocs = await findPostSitemapDocs(payload)
    const slugs = await findPostSlugs(payload)
    const totalDocs = await countPublishedPosts(payload)

    expect(sitemapDocs).toEqual([{ id: 5, slug: 'sitemap-post', updatedAt: '2026-01-01T00:00:00.000Z' }])
    expect(slugs).toEqual([{ id: 6, slug: 'archive-post' }])
    expect(totalDocs).toBe(17)
    expect(findMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'posts',
        depth: 0,
        limit: 1000,
        pagination: false,
        overrideAccess: false,
        select: POST_SITEMAP_SELECT,
      }),
    )
    expect(findMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'posts',
        depth: 0,
        limit: 1000,
        pagination: false,
        overrideAccess: false,
        select: POST_SLUG_SELECT,
      }),
    )
    expect(countMock).toHaveBeenCalledWith({
      collection: 'posts',
      overrideAccess: false,
      where: { _status: { equals: 'published' } },
    })
  })

  it('supports page slugs, page detail reads and sitemap docs', async () => {
    const { payload, findMock } = createPayloadMock()
    findMock.mockResolvedValueOnce({ docs: [{ id: 7, slug: 'about', layout: [] }] })
    findMock.mockResolvedValueOnce({ docs: [{ id: 8, slug: 'home' }] })
    findMock.mockResolvedValueOnce({ docs: [{ id: 9, slug: 'sitemap-page', updatedAt: '2026-01-01T00:00:00.000Z' }] })

    const page = await findPageBySlug(payload, 'about')
    const pageSlugs = await findPageSlugs(payload)
    const sitemapDocs = await findPageSitemapDocs(payload)

    expect(page).toEqual({ id: 7, slug: 'about', layout: [] })
    expect(pageSlugs).toEqual([{ id: 8, slug: 'home' }])
    expect(sitemapDocs).toEqual([{ id: 9, slug: 'sitemap-page', updatedAt: '2026-01-01T00:00:00.000Z' }])
    expect(findMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'pages',
        depth: 0,
        draft: false,
        limit: 1,
        pagination: false,
        overrideAccess: false,
        where: {
          and: [{ _status: { equals: 'published' } }, { slug: { equals: 'about' } }],
        },
        select: PAGE_DETAIL_SELECT,
      }),
    )
    expect(findMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'pages',
        depth: 0,
        limit: 1000,
        pagination: false,
        overrideAccess: false,
        select: PAGE_SLUG_SELECT,
      }),
    )
    expect(findMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        collection: 'pages',
        depth: 0,
        limit: 1000,
        pagination: false,
        overrideAccess: false,
        select: PAGE_SITEMAP_SELECT,
      }),
    )
  })
})
