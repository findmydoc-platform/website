import { JSDOM } from 'jsdom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  findPageSitemapDocs: vi.fn(),
  findPostSitemapDocs: vi.fn(),
  getListingComparisonServerData: vi.fn(),
  getPayload: vi.fn(),
  resolveSitemapIndexingAccessForRequest: vi.fn(),
  unstableCache: vi.fn((callback: () => unknown) => callback),
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
  resolveSitemapIndexingAccessForRequest: routeMocks.resolveSitemapIndexingAccessForRequest,
}))

const readSitemap = async (response: Response) => {
  expect(response.headers.get('content-type')).toContain('text/xml')
  const document = new JSDOM(await response.text(), { contentType: 'text/xml' }).window.document
  expect(document.documentElement.localName).toBe('urlset')
  expect(document.documentElement.namespaceURI).toBe('http://www.sitemaps.org/schemas/sitemap/0.9')
  return {
    entries: Array.from(document.querySelectorAll('url')).map((entry) => ({
      loc: entry.querySelector('loc')?.textContent ?? '',
      ...(entry.querySelector('lastmod') ? { lastmod: entry.querySelector('lastmod')?.textContent } : {}),
    })),
  }
}

const getEntryLocations = (entries: Array<{ loc: string }>) => entries.map((entry) => entry.loc)

describe('frontend sitemap routes', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
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
    routeMocks.resolveSitemapIndexingAccessForRequest.mockResolvedValue({ allowed: true })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns an empty noindex pages sitemap when discovery is blocked', async () => {
    routeMocks.resolveSitemapIndexingAccessForRequest.mockResolvedValue({
      allowed: false,
      reason: 'preview-runtime',
    })
    const request = new Request('https://findmydoc.eu/pages-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/pages-sitemap.xml/route')

    const response = await GET(request)
    const body = await readSitemap(response)

    expect(routeMocks.resolveSitemapIndexingAccessForRequest).toHaveBeenCalledWith(request)
    expect(routeMocks.findPageSitemapDocs).not.toHaveBeenCalled()
    expect(body.entries).toEqual([])
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
  })

  it('returns an empty noindex posts sitemap when discovery is blocked', async () => {
    routeMocks.resolveSitemapIndexingAccessForRequest.mockResolvedValue({
      allowed: false,
      reason: 'preview-runtime',
    })
    const request = new Request('https://findmydoc.eu/posts-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/posts-sitemap.xml/route')

    const response = await GET(request)
    const body = await readSitemap(response)

    expect(routeMocks.resolveSitemapIndexingAccessForRequest).toHaveBeenCalledWith(request)
    expect(routeMocks.findPostSitemapDocs).not.toHaveBeenCalled()
    expect(body.entries).toEqual([])
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
  })

  it('returns exactly the canonical language paths and blog index in the Holding pages sitemap', async () => {
    routeMocks.resolveSitemapIndexingAccessForRequest.mockResolvedValue({
      allowed: true,
      temporaryLandingMode: true,
    })
    const request = new Request('https://findmydoc.eu/pages-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/pages-sitemap.xml/route')

    const response = await GET(request)
    const body = await readSitemap(response)

    expect(body.entries).toEqual([
      { loc: 'https://findmydoc.eu/' },
      { loc: 'https://findmydoc.eu/en' },
      { loc: 'https://findmydoc.eu/tr' },
      { loc: 'https://findmydoc.eu/posts' },
    ])
    expect(routeMocks.findPageSitemapDocs).not.toHaveBeenCalled()
  })

  it('includes fixed public routes in the pages sitemap', async () => {
    routeMocks.findPageSitemapDocs.mockResolvedValue([])
    const request = new Request('https://findmydoc.eu/pages-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/pages-sitemap.xml/route')

    const response = await GET(request)
    const body = await readSitemap(response)
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
    expect(routeMocks.unstableCache).toHaveBeenCalledWith(expect.any(Function), ['pages-sitemap', 'localized'], {
      tags: ['surface:sitemap:pages'],
    })
  })

  it('normalizes and deduplicates CMS pages in the pages sitemap', async () => {
    routeMocks.findPageSitemapDocs.mockImplementation(async (_payload, locale) =>
      locale === 'en'
        ? []
        : [
            { slug: 'home', updatedAt: '2026-01-01T00:00:00.000Z' },
            { slug: 'about', updatedAt: '2026-01-01T00:00:00.000Z' },
            { slug: 'search', updatedAt: '2026-01-01T00:00:00.000Z' },
            { slug: 'privacy-policy', updatedAt: '2026-01-02T00:00:00.000Z' },
            { slug: 'imprint', updatedAt: '2026-01-03T00:00:00.000Z' },
            { slug: 'custom-page', updatedAt: '2026-01-01T00:00:00.000Z' },
            { slug: '/custom-page/', updatedAt: '2026-01-04T00:00:00.000Z' },
            { slug: '', updatedAt: '2026-01-01T00:00:00.000Z' },
          ],
    )
    const request = new Request('https://findmydoc.eu/pages-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/pages-sitemap.xml/route')

    const response = await GET(request)
    const body = await readSitemap(response)
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

  it('adds the English page canonical after publication and removes it independently of German', async () => {
    const german = [
      { id: 1, slug: 'pflege/deutschland' },
      { id: 2, slug: 'home' },
    ]
    const english = [
      { id: 1, slug: 'care/germany' },
      { id: 2, slug: 'home' },
    ]
    let englishPublished = false
    routeMocks.findPageSitemapDocs.mockImplementation(async (_payload, locale) =>
      locale === 'en' ? (englishPublished ? english : []) : german,
    )
    const request = new Request('https://findmydoc.eu/pages-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/pages-sitemap.xml/route')
    const locations = async () => getEntryLocations((await readSitemap(await GET(request))).entries)

    expect(await locations()).toContain('https://findmydoc.eu/pflege/deutschland')
    expect(await locations()).not.toContain('https://findmydoc.eu/en/care/germany')
    expect(await locations()).not.toContain('https://findmydoc.eu/en')

    englishPublished = true
    expect(await locations()).toEqual(
      expect.arrayContaining(['https://findmydoc.eu/en/care/germany', 'https://findmydoc.eu/en']),
    )

    englishPublished = false
    const withdrawnLocations = await locations()
    expect(withdrawnLocations).toContain('https://findmydoc.eu/pflege/deutschland')
    expect(withdrawnLocations).not.toContain('https://findmydoc.eu/en/care/germany')
    expect(withdrawnLocations).not.toContain('https://findmydoc.eu/en')
  })

  it('includes only valid post detail routes in the posts sitemap', async () => {
    routeMocks.findPostSitemapDocs
      .mockResolvedValueOnce([
        { slug: 'first-post', updatedAt: '2026-01-01T00:00:00.000Z' },
        { slug: ' second-post ', updatedAt: '2026-01-02T00:00:00.000Z' },
        { slug: '', updatedAt: '2026-01-03T00:00:00.000Z' },
        { slug: null, updatedAt: '2026-01-04T00:00:00.000Z' },
        { slug: 'nested/post', updatedAt: '2026-01-05T00:00:00.000Z' },
      ])
      .mockResolvedValueOnce([{ slug: 'english-post' }])
    const request = new Request('https://findmydoc.eu/posts-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/posts-sitemap.xml/route')

    const response = await GET(request)
    const body = await readSitemap(response)
    const locs = getEntryLocations(body.entries)

    expect(locs).toEqual([
      'https://findmydoc.eu/posts/first-post',
      'https://findmydoc.eu/posts/second-post',
      'https://findmydoc.eu/en/posts/english-post',
    ])
    expect(body.entries[0]).toMatchObject({ lastmod: '2026-01-01T00:00:00.000Z' })
    expect(routeMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['posts-sitemap', 'reachable-legacy-canonical'],
      {
        tags: ['surface:sitemap:posts'],
      },
    )
  })

  it('keeps the migrated article’s existing URL in the sitemap until German is published', async () => {
    const english = { id: 41, slug: 'english-post', legacyEnglishSlug: 'existing-post' }
    const german = { id: 41, slug: 'german-post' }
    let germanPublished = false
    routeMocks.findPostSitemapDocs.mockImplementation(async (_payload, locale) =>
      locale === 'en' ? [english] : germanPublished ? [german] : [],
    )
    const request = new Request('https://findmydoc.eu/posts-sitemap.xml')
    const { GET } = await import('@/app/(frontend)/(sitemaps)/posts-sitemap.xml/route')
    const locations = async () => getEntryLocations((await readSitemap(await GET(request))).entries)

    expect(await locations()).toEqual(['https://findmydoc.eu/posts/existing-post'])

    germanPublished = true
    expect(await locations()).toEqual([
      'https://findmydoc.eu/posts/german-post',
      'https://findmydoc.eu/en/posts/english-post',
    ])
  })

  it('skips a legacy alias whose stored spelling cannot resolve to the normalized URL', async () => {
    routeMocks.findPostSitemapDocs.mockImplementation(async (_payload, locale) =>
      locale === 'en' ? [{ id: 41, slug: 'english-post', legacyEnglishSlug: 'former ' }] : [{ id: 42, slug: 'former' }],
    )
    const { GET } = await import('@/app/(frontend)/(sitemaps)/posts-sitemap.xml/route')
    const sitemap = await readSitemap(await GET(new Request('https://findmydoc.eu/posts-sitemap.xml')))

    expect(getEntryLocations(sitemap.entries)).toEqual([
      'https://findmydoc.eu/posts/former',
      'https://findmydoc.eu/en/posts/english-post',
    ])
  })
})
