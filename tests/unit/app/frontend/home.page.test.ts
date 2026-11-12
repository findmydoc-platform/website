import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { HOLDING_VIEW_REQUEST_HEADER, TEMPORARY_LANDING_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'

import { cloneBaselineLandingPages } from '../../helpers/landingPagesBaseline'

const mocks = vi.hoisted(() => ({
  headersMock: vi.fn(),
  getPayloadMock: vi.fn(),
  payloadFindMock: vi.fn(),
  payloadFindGlobalMock: vi.fn(),
  getCachedLatestPostsMock: vi.fn(),
  getLandingMedicalSpecialtyCategoriesMock: vi.fn(),
  normalizePostMock: vi.fn((post: unknown) => post),
  temporaryLandingPageComponent: vi.fn(() => null),
}))

vi.mock('next/headers', () => ({
  headers: mocks.headersMock,
  cookies: vi.fn(async () => new Map()),
  draftMode: vi.fn(async () => ({ isEnabled: false })),
}))

vi.mock('@/app/(frontend)/AdminBarClientAdapter.client', () => ({ AdminBarClientAdapter: () => null }))
vi.mock('@/app/(frontend)/_components/SupabaseAuthHashUrlScrubber.client', () => ({
  SupabaseAuthHashUrlScrubber: () => null,
}))
vi.mock('@/features/cookieConsent/CookieConsentClientAdapter.client', () => ({
  CookieConsentClientAdapter: () => null,
}))
vi.mock('@vercel/toolbar/next', () => ({ VercelToolbar: () => null }))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: mocks.getPayloadMock,
  }
})

vi.mock('@/utilities/landing/medicalSpecialtyCategories', () => ({
  getLandingMedicalSpecialtyCategories: mocks.getLandingMedicalSpecialtyCategoriesMock,
}))

vi.mock('@/utilities/blog/normalizePost', () => ({
  normalizePost: mocks.normalizePostMock,
}))

vi.mock('@/utilities/content/serverData', () => ({
  getCachedLatestPosts: mocks.getCachedLatestPostsMock,
}))

vi.mock('@/utilities/media/resolveMediaImage', () => ({
  resolveMediaImage: (_media: unknown, options: { fallbackAlt?: string }) => ({
    src: '/seeded-landing-media.jpg',
    alt: options.fallbackAlt ?? '',
    sizes: '(max-width: 1024px) 100vw, 50vw',
    quality: 75,
  }),
}))

vi.mock('@/features/contactRequests/FormBridgePublicContactSectionAdapter.client', () => ({
  FormBridgePublicContactSectionAdapter: vi.fn(() => null),
}))

vi.mock('@/features/contactRequests/FormBridgeTemporaryLandingPageAdapter', () => ({
  FormBridgeTemporaryLandingPageAdapter: mocks.temporaryLandingPageComponent,
}))

describe('frontend home page route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.headersMock.mockResolvedValue(new Headers())
    mocks.payloadFindMock.mockResolvedValue({ docs: [] })
    mocks.payloadFindGlobalMock.mockResolvedValue(cloneBaselineLandingPages())
    mocks.getCachedLatestPostsMock.mockResolvedValue([])
    mocks.getLandingMedicalSpecialtyCategoriesMock.mockResolvedValue({
      categories: [],
      items: [],
      featuredIds: [],
    })

    mocks.getPayloadMock.mockResolvedValue({
      find: mocks.payloadFindMock,
      findGlobal: mocks.payloadFindGlobalMock,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('renders the standalone Production Holding document without blocking robots or Googlebot metadata', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'production')
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://findmydoc.eu')
    mocks.headersMock.mockResolvedValue(
      new Headers({
        [HOLDING_VIEW_REQUEST_HEADER]: 'standalone',
        [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1',
      }),
    )
    const layoutModule = await import('@/app/(frontend)/layout')
    const document = renderToStaticMarkup(await layoutModule.default({ children: null }))

    expect(document).not.toMatch(/<meta[^>]+name="(?:robots|googlebot)"/)
    expect(layoutModule.metadata.robots).toBeUndefined()
    const structuredData = Array.from(
      document.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g),
      ([, json]) => JSON.parse(json ?? 'null'),
    )
    expect(structuredData).toEqual([
      {
        '@context': 'https://schema.org',
        '@id': 'https://findmydoc.eu/#organization',
        '@type': 'Organization',
        name: 'findmydoc',
        url: 'https://findmydoc.eu/',
      },
      {
        '@context': 'https://schema.org',
        '@id': 'https://findmydoc.eu/#website',
        '@type': 'WebSite',
        description: expect.any(String),
        name: 'findmydoc',
        publisher: { '@id': 'https://findmydoc.eu/#organization' },
        url: 'https://findmydoc.eu/',
      },
    ])
  })

  it('returns temporary landing page when landing request header is set', async () => {
    mocks.headersMock.mockResolvedValue(new Headers({ [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1' }))

    const pageModule = await import('@/app/(frontend)/page')
    const result = await pageModule.default({})

    expect(mocks.getPayloadMock).not.toHaveBeenCalled()
    expect(mocks.getCachedLatestPostsMock).toHaveBeenCalledWith(3, {})
    expect(result.type).toBe(mocks.temporaryLandingPageComponent)
    expect(result.props.locale).toBe('en')
    expect(result.props.languageOptions).toEqual([
      { value: 'en', label: 'EN', href: '/?lang=en' },
      { value: 'de', label: 'DE', href: '/?lang=de' },
      { value: 'tr', label: 'TR', href: '/?lang=tr' },
    ])
    expect(result.props.contentLocale).toEqual({})
    expect(result.props.posts).toEqual([])
  })

  it.each([
    [
      'Preview Holding',
      'preview',
      { [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1', [HOLDING_VIEW_REQUEST_HEADER]: 'standalone' },
    ],
    ['Preview Full', 'preview', {}],
    [
      'an excluded Production Holding page',
      'production',
      { [HOLDING_VIEW_REQUEST_HEADER]: 'standalone', 'x-search-indexing': 'noindex' },
    ],
  ] as const)('keeps robots and Googlebot blocked for %s', async (_description, runtime, requestHeaders) => {
    vi.stubEnv('VERCEL_ENV', runtime)
    vi.stubEnv('DEPLOYMENT_ENVIRONMENT', runtime)
    mocks.headersMock.mockResolvedValue(new Headers(requestHeaders))
    const layoutModule = await import('@/app/(frontend)/layout')
    const document = renderToStaticMarkup(await layoutModule.default({ children: null }))

    expect(document).toContain('<meta content="noindex, nofollow, noarchive" name="robots"/>')
    expect(document).toContain('<meta content="noindex, nofollow, noarchive, noimageindex" name="googlebot"/>')
    expect(document).not.toContain('type="application/ld+json"')
    if (runtime === 'preview') {
      expect(layoutModule.metadata.robots).toMatchObject({ index: false, googleBot: { index: false } })
    }
  })

  it.each([undefined, 'en', 'de', 'tr'])(
    'keeps the Production root canonical for Holding language %s',
    async (lang) => {
      vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://findmydoc.eu')
      mocks.headersMock.mockResolvedValue(new Headers({ [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1' }))
      const pageModule = await import('@/app/(frontend)/page')
      const metadata = await pageModule.generateMetadata({
        searchParams: Promise.resolve({ lang, source: 'language-choice' }),
      })

      expect(metadata).toMatchObject({
        alternates: { canonical: '/' },
        openGraph: { url: 'https://findmydoc.eu/' },
      })
      expect(metadata.alternates?.languages).toBeUndefined()
      expect(metadata.robots).toBeUndefined()
    },
  )

  it('passes resolved locale and language options to temporary landing page', async () => {
    mocks.headersMock.mockResolvedValue(new Headers({ [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1' }))

    const pageModule = await import('@/app/(frontend)/page')
    const result = await pageModule.default({
      searchParams: Promise.resolve({
        foo: 'bar',
        lang: 'de',
      }),
    })

    expect(result.type).toBe(mocks.temporaryLandingPageComponent)
    expect(result.props.locale).toBe('de')
    expect(mocks.getCachedLatestPostsMock).toHaveBeenCalledWith(3, {
      locale: 'de',
      fallbackLocale: 'en',
    })
    expect(result.props.contentLocale).toEqual({ locale: 'de', fallbackLocale: 'en' })
    expect(result.props.languageOptions).toEqual([
      { value: 'en', label: 'EN', href: '/?foo=bar&lang=en' },
      { value: 'de', label: 'DE', href: '/?foo=bar&lang=de' },
      { value: 'tr', label: 'TR', href: '/?foo=bar&lang=tr' },
    ])
  })

  it.each(['en', 'de', 'tr'] as const)('maps localized holding metadata for %s', async (locale) => {
    mocks.headersMock.mockResolvedValue(new Headers({ [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1' }))
    const contentModule = await import('@/features/temporaryLandingMode')
    const getContent = contentModule.getTemporaryLandingPageContent
    const getContentMock = vi.spyOn(contentModule, 'getTemporaryLandingPageContent').mockImplementation((lang) => {
      const content = getContent(lang)
      return {
        ...content,
        searchSnapshot: {
          ...content.searchSnapshot,
          metaTitle: `findmydoc | holding-${lang}-title`,
          metaDescription: `holding-${lang}-description`,
        },
      }
    })
    const pageModule = await import('@/app/(frontend)/page')

    const metadata = await pageModule.generateMetadata({ searchParams: Promise.resolve({ lang: locale }) })

    expect(getContentMock).toHaveBeenCalledWith(locale)
    expect(metadata).toMatchObject({
      title: `findmydoc | holding-${locale}-title`,
      description: `holding-${locale}-description`,
    })
  })

  it('loads regular homepage data when landing request header is missing', async () => {
    const pageModule = await import('@/app/(frontend)/page')
    await pageModule.default({})

    expect(mocks.getPayloadMock).toHaveBeenCalledTimes(2)
    expect(mocks.getCachedLatestPostsMock).toHaveBeenCalledTimes(1)
    expect(mocks.getCachedLatestPostsMock).toHaveBeenCalledWith(3)
    expect(mocks.payloadFindMock).toHaveBeenCalledTimes(1)
    expect(mocks.payloadFindMock).toHaveBeenCalledWith({
      collection: 'cities',
      depth: 0,
      limit: 250,
      overrideAccess: false,
      pagination: false,
      sort: 'name',
      select: {
        id: true,
        name: true,
      },
    })
    expect(mocks.getLandingMedicalSpecialtyCategoriesMock).toHaveBeenCalledTimes(1)
    expect(mocks.payloadFindGlobalMock).toHaveBeenCalledWith({
      slug: 'landingPages',
      depth: 2,
    })
  })

  it('fails fast when regular landing content global is missing', async () => {
    mocks.payloadFindGlobalMock.mockResolvedValueOnce(null)

    const pageModule = await import('@/app/(frontend)/page')

    await expect(pageModule.default({})).rejects.toThrow(
      'Landing pages global is missing. Run the baseline seed before rendering landing routes.',
    )
  })

  it('returns seeded homepage metadata when landing request header is missing', async () => {
    const pageModule = await import('@/app/(frontend)/page')
    const metadata = await pageModule.generateMetadata({})

    expect(mocks.getPayloadMock).toHaveBeenCalledTimes(1)
    expect(mocks.payloadFindGlobalMock).toHaveBeenCalledWith({
      slug: 'landingPages',
      depth: 2,
    })
    expect(metadata).toMatchObject({
      title: 'Gain International Patients | Global Clinic Visibility Platform | findmydoc',
      description:
        'Gain international patients through a trusted comparison platform. Increase clinic reach, visibility, and qualified global patient inquiries.',
    })
  })
})
