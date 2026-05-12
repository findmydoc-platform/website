import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  findPageSitemapDocs: vi.fn(),
  findPostSitemapDocs: vi.fn(),
  getPayload: vi.fn(),
  getServerSideSitemap: vi.fn(),
  shouldBlockSitemapIndexingForRequest: vi.fn(),
  unstableCache: vi.fn((callback: () => unknown) => callback),
}))

vi.mock('next-sitemap', () => ({
  getServerSideSitemap: routeMocks.getServerSideSitemap,
}))

vi.mock('payload', () => ({
  getPayload: routeMocks.getPayload,
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('next/cache', () => ({
  unstable_cache: routeMocks.unstableCache,
}))

vi.mock('@/utilities/content/serverData', () => ({
  findPageSitemapDocs: routeMocks.findPageSitemapDocs,
  findPostSitemapDocs: routeMocks.findPostSitemapDocs,
}))

vi.mock('@/features/searchIndexing/sitemapGuards', () => ({
  shouldBlockSitemapIndexingForRequest: routeMocks.shouldBlockSitemapIndexingForRequest,
}))

describe('frontend sitemap routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMocks.getPayload.mockResolvedValue({})
    routeMocks.getServerSideSitemap.mockImplementation((entries: unknown[], headers?: Record<string, string>) => {
      return Response.json({ entries, headers })
    })
    routeMocks.shouldBlockSitemapIndexingForRequest.mockResolvedValue(false)
  })

  it('returns an empty noindex pages sitemap when temporary landing mode blocks indexing', async () => {
    routeMocks.shouldBlockSitemapIndexingForRequest.mockResolvedValue(true)
    const request = new Request('https://findmydoc.eu/pages-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/pages-sitemap.xml/route')

    const response = await GET(request)
    const body = await response.json()

    expect(routeMocks.shouldBlockSitemapIndexingForRequest).toHaveBeenCalledWith(request)
    expect(routeMocks.findPageSitemapDocs).not.toHaveBeenCalled()
    expect(body).toEqual({
      entries: [],
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    })
  })

  it('returns an empty noindex posts sitemap when temporary landing mode blocks indexing', async () => {
    routeMocks.shouldBlockSitemapIndexingForRequest.mockResolvedValue(true)
    const request = new Request('https://findmydoc.eu/posts-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/posts-sitemap.xml/route')

    const response = await GET(request)
    const body = await response.json()

    expect(routeMocks.shouldBlockSitemapIndexingForRequest).toHaveBeenCalledWith(request)
    expect(routeMocks.findPostSitemapDocs).not.toHaveBeenCalled()
    expect(body).toEqual({
      entries: [],
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    })
  })
})
