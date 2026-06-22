import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  findPageSitemapDocs: vi.fn(),
  findPostSitemapDocs: vi.fn(),
  getListingComparisonServerData: vi.fn(),
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

vi.mock('@/utilities/listingComparison/serverData', () => ({
  getListingComparisonServerData: routeMocks.getListingComparisonServerData,
}))

vi.mock('@/features/searchIndexing/sitemapGuards', () => ({
  shouldBlockSitemapIndexingForRequest: routeMocks.shouldBlockSitemapIndexingForRequest,
}))

const getEntryLocations = (entries: Array<{ loc: string }>) => entries.map((entry) => entry.loc)

describe('frontend sitemap routes', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SERVER_URL: 'https://findmydoc.eu',
    }

    vi.clearAllMocks()
    routeMocks.getPayload.mockResolvedValue({})
    routeMocks.getListingComparisonServerData.mockResolvedValue({
      freshness: {
        updatedAt: '2026-01-06T00:00:00.000Z',
        sourceCollections: ['clinics'],
      },
    })
    routeMocks.getServerSideSitemap.mockImplementation((entries: unknown[], headers?: Record<string, string>) => {
      return Response.json({ entries, headers })
    })
    routeMocks.shouldBlockSitemapIndexingForRequest.mockResolvedValue(false)
  })

  afterEach(() => {
    process.env = originalEnv
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

  it('includes fixed public routes in the pages sitemap', async () => {
    routeMocks.findPageSitemapDocs.mockResolvedValue([])
    const request = new Request('https://findmydoc.eu/pages-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/pages-sitemap.xml/route')

    const response = await GET(request)
    const body = await response.json()
    const locs = getEntryLocations(body.entries)

    expect(locs).toEqual(
      expect.arrayContaining([
        'https://findmydoc.eu/',
        'https://findmydoc.eu/posts',
        'https://findmydoc.eu/contact',
        'https://findmydoc.eu/about',
        'https://findmydoc.eu/listing-comparison',
      ]),
    )
    expect(locs).not.toContain('https://findmydoc.eu/search')
    expect(locs.some((loc: string) => loc.includes('?'))).toBe(false)
    expect(body.entries.find((entry: { loc: string }) => entry.loc.endsWith('/contact'))).not.toHaveProperty('lastmod')
    expect(body.entries.find((entry: { loc: string }) => entry.loc.endsWith('/listing-comparison'))).toMatchObject({
      lastmod: '2026-01-06T00:00:00.000Z',
    })
  })

  it('normalizes and deduplicates CMS pages in the pages sitemap', async () => {
    routeMocks.findPageSitemapDocs.mockResolvedValue([
      { slug: 'home', updatedAt: '2026-01-01T00:00:00.000Z' },
      { slug: 'about', updatedAt: '2026-01-01T00:00:00.000Z' },
      { slug: 'search', updatedAt: '2026-01-01T00:00:00.000Z' },
      { slug: 'privacy-policy', updatedAt: '2026-01-02T00:00:00.000Z' },
      { slug: 'imprint', updatedAt: '2026-01-03T00:00:00.000Z' },
      { slug: 'custom-page', updatedAt: '2026-01-01T00:00:00.000Z' },
      { slug: '/custom-page/', updatedAt: '2026-01-04T00:00:00.000Z' },
      { slug: '', updatedAt: '2026-01-01T00:00:00.000Z' },
    ])
    const request = new Request('https://findmydoc.eu/pages-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/pages-sitemap.xml/route')

    const response = await GET(request)
    const body = await response.json()
    const locs = getEntryLocations(body.entries)

    expect(locs.filter((loc: string) => loc === 'https://findmydoc.eu/')).toHaveLength(1)
    expect(locs.filter((loc: string) => loc.endsWith('/about'))).toHaveLength(1)
    expect(locs.filter((loc: string) => loc.endsWith('/search'))).toHaveLength(0)
    expect(locs.filter((loc: string) => loc.endsWith('/custom-page'))).toHaveLength(1)
    expect(locs).toEqual(
      expect.arrayContaining(['https://findmydoc.eu/privacy-policy', 'https://findmydoc.eu/imprint']),
    )
    expect(body.entries.find((entry: { loc: string }) => entry.loc === 'https://findmydoc.eu/')).toMatchObject({
      lastmod: '2026-01-01T00:00:00.000Z',
    })
    expect(body.entries.find((entry: { loc: string }) => entry.loc.endsWith('/about'))).toMatchObject({
      lastmod: '2026-01-01T00:00:00.000Z',
    })
  })

  it('includes only valid post detail routes in the posts sitemap', async () => {
    routeMocks.findPostSitemapDocs.mockResolvedValue([
      { slug: 'first-post', updatedAt: '2026-01-01T00:00:00.000Z' },
      { slug: ' second-post ', updatedAt: '2026-01-02T00:00:00.000Z' },
      { slug: '', updatedAt: '2026-01-03T00:00:00.000Z' },
      { slug: null, updatedAt: '2026-01-04T00:00:00.000Z' },
      { slug: 'nested/post', updatedAt: '2026-01-05T00:00:00.000Z' },
    ])
    const request = new Request('https://findmydoc.eu/posts-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/posts-sitemap.xml/route')

    const response = await GET(request)
    const body = await response.json()
    const locs = getEntryLocations(body.entries)

    expect(locs).toEqual(['https://findmydoc.eu/posts/first-post', 'https://findmydoc.eu/posts/second-post'])
    expect(body.entries[0]).toMatchObject({ lastmod: '2026-01-01T00:00:00.000Z' })
  })
})
