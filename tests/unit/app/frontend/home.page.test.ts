import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { HOLDING_VIEW_REQUEST_HEADER, TEMPORARY_LANDING_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'
import { FRONTEND_PATH_HEADER } from '@/i18n/requestLocale'

import { cloneBaselineLandingPages } from '../../helpers/landingPagesBaseline'

const mocks = vi.hoisted(() => ({
  headersMock: vi.fn(),
  getPayloadMock: vi.fn(),
  payloadFindMock: vi.fn(),
  payloadFindGlobalMock: vi.fn(),
  getCachedLatestPostsMock: vi.fn(),
  getCachedPostArchivePageMock: vi.fn(),
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
vi.mock('@/app/(frontend)/_data/cookieConsent', () => ({
  getCookieConsentConfigs: async () => ({ de: null, en: null }),
}))
vi.mock('@/features/cookieConsent/CookieConsentClientAdapter.client', () => ({
  CookieConsentClientAdapter: () => null,
}))
vi.mock('@vercel/toolbar/next', () => ({ VercelToolbar: () => null }))

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn() }),
}))
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
  getCachedPostArchivePage: mocks.getCachedPostArchivePageMock,
}))

vi.mock('@/utilities/media/resolveMediaImage', () => ({
  resolveMediaImage: (_media: unknown, options: { fallbackAlt?: string }) => ({
    src: '/seeded-landing-media.jpg',
    alt: options.fallbackAlt ?? '',
    sizes: '(max-width: 1024px) 100vw, 50vw',
    quality: 75,
  }),
}))

vi.mock('@/features/contactRequests/LocalizedPublicContactSection', () => ({
  LocalizedPublicContactSection: () => null,
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
    mocks.getCachedPostArchivePageMock.mockResolvedValue({ docs: [] })
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

    expect(mocks.payloadFindGlobalMock).not.toHaveBeenCalled()
    expect(mocks.getCachedLatestPostsMock).toHaveBeenCalledWith(3, { locale: 'de', fallbackLocale: 'en' })
    expect(result.type).toBe(mocks.temporaryLandingPageComponent)
    expect(result.props.locale).toBe('de')
    expect(result.props.languageOptions).toEqual([
      { value: 'en', label: 'EN', href: '/en' },
      { value: 'de', label: 'DE', href: '/' },
      { value: 'tr', label: 'TR', href: '/tr' },
    ])
    expect(result.props.contentLocale).toEqual({ locale: 'de', fallbackLocale: 'en' })
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

  it.each([
    ['/', 'de'],
    ['/en', 'en'],
    ['/tr', 'tr'],
  ])('renders the Holding language from %s with its own canonical URL', async (path, lang) => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://findmydoc.eu')
    mocks.headersMock.mockResolvedValue(
      new Headers({
        [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1',
        [HOLDING_VIEW_REQUEST_HEADER]: 'standalone',
        [FRONTEND_PATH_HEADER]: path,
      }),
    )
    const searchParams = Promise.resolve({ lang: lang === 'tr' ? 'en' : 'tr', utm_source: 'test' })
    const args = { params: Promise.resolve({ slug: [path.slice(1)] }), searchParams }
    const metadata =
      path === '/'
        ? await (await import('@/app/(frontend)/page')).generateMetadata()
        : await (await import('@/app/(frontend)/(pages)/[...slug]/page')).generateMetadata(args)
    const result =
      path === '/'
        ? await (await import('@/app/(frontend)/page')).default({ searchParams })
        : await (await import('@/app/(frontend)/(pages)/[...slug]/page')).default(args)
    const layout = await import('@/app/(frontend)/layout')
    const html = renderToStaticMarkup(await layout.default({ children: null }))

    expect(html).toContain(`<html lang="${lang}"`)
    expect(result.props.locale).toBe(lang)
    expect(metadata.alternates?.canonical).toBe(`https://findmydoc.eu${path}`)
    expect(metadata.alternates?.languages).toEqual(
      lang === 'tr'
        ? undefined
        : {
            de: 'https://findmydoc.eu/',
            en: 'https://findmydoc.eu/en',
            'x-default': 'https://findmydoc.eu/',
          },
    )
    expect(metadata.robots).toBeUndefined()
  })

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
      { value: 'en', label: 'EN', href: '/en?foo=bar' },
      { value: 'de', label: 'DE', href: '/?foo=bar' },
      { value: 'tr', label: 'TR', href: '/tr?foo=bar' },
    ])
  })

  it('uses the selected locale for Holding titles and descriptions', async () => {
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

    const metadata = await pageModule.generateMetadata()

    expect(getContentMock).toHaveBeenCalledWith('de')
    expect(metadata).toMatchObject({
      title: 'findmydoc | holding-de-title',
      description: 'holding-de-description',
    })
  })

  it('renders the German homepage from the German CMS fields with a German comparison link', async () => {
    const global = cloneBaselineLandingPages()
    global.home.hero.title = 'German CMS hero fixture'
    mocks.payloadFindGlobalMock.mockImplementation(({ locale }) => (locale === 'de' ? global : null))
    const pageModule = await import('@/app/(frontend)/page')

    const markup = renderToStaticMarkup(await pageModule.default({}))
    expect(markup).toMatch(/<article[^>]+lang="de"/)
    expect(markup).toMatch(/<h1[^>]*>German CMS hero fixture<\/h1>/)
    expect(markup).toMatch(/href="\/listing-comparison"/)
  })

  it('fails fast when regular landing content global is missing', async () => {
    mocks.payloadFindGlobalMock.mockResolvedValueOnce(null)

    const pageModule = await import('@/app/(frontend)/page')

    await expect(pageModule.default({})).rejects.toThrow(
      'Landing pages global is missing. Run the baseline seed before rendering landing routes.',
    )
  })

  it('returns CMS homepage metadata when landing request header is missing', async () => {
    const landingPages = cloneBaselineLandingPages()
    landingPages.home.seo = { title: 'Test homepage title', description: 'Test homepage description' }
    mocks.payloadFindGlobalMock.mockResolvedValueOnce(landingPages)
    const pageModule = await import('@/app/(frontend)/page')
    const metadata = await pageModule.generateMetadata()

    expect(metadata).toMatchObject({
      title: 'Test homepage title | findmydoc',
      description: 'Test homepage description',
      alternates: { canonical: '/' },
    })
  })

  it('advertises a reciprocal alternate once the English CMS home is published', async () => {
    mocks.payloadFindMock.mockImplementation(({ collection, locale }) => ({
      docs: collection === 'pages' && locale === 'en' ? [{ slug: 'home' }] : [],
    }))
    const pageModule = await import('@/app/(frontend)/page')

    expect((await pageModule.generateMetadata()).alternates).toEqual({
      canonical: '/',
      languages: { de: '/', en: '/en', 'x-default': '/' },
    })
  })
})
