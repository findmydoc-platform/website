import { Writable } from 'node:stream'
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Where } from 'payload'

import { TEMPORARY_LANDING_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'
import { FRONTEND_PATH_HEADER } from '@/i18n/requestLocale'
import { cloneBaselineLandingPages } from '../../helpers/landingPagesBaseline'

const mocks = vi.hoisted(() => ({
  draftMode: vi.fn(),
  find: vi.fn(),
  findGlobal: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('next/headers', () => ({ draftMode: mocks.draftMode, headers: mocks.headers }))
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: async () => ({ find: mocks.find, findGlobal: mocks.findGlobal }),
}))
vi.mock('@/app/(frontend)/_components/PayloadRedirects', () => ({ PayloadRedirects: () => null }))
vi.mock('@/blocks/RenderBlocks', () => ({ RenderBlocks: () => null }))
vi.mock('@/features/contactRequests/LocalizedPublicContactSection', () => ({
  LocalizedPublicContactSection: () => null,
}))
vi.mock('@/features/uiCopy/publicContact', () => ({ publicContactCopy: async () => undefined }))
vi.mock('@/components/organisms/LivePreviewListener', () => ({ LivePreviewListener: () => null }))

const germanPage = { id: 4, slug: 'pflege/deutschland', meta: { title: 'German page' } }
const englishPage = { id: 4, slug: 'care/germany', meta: { title: 'English page' } }

function findPages(publishedEnglish: boolean, paths = { de: germanPage, en: englishPage }) {
  mocks.find.mockImplementation(
    ({ collection, locale, where }: { collection: string; locale: string; where: Where }) => {
      if (collection !== 'pages') return { docs: [] }
      const candidates = locale === 'de' ? [paths.de] : publishedEnglish ? [paths.en] : []
      const conditions = where?.and ?? [where]
      const slug = conditions.find((condition) => condition?.slug)?.slug
      const id = conditions.find((condition) => condition?.id)?.id
      return {
        docs: candidates.filter(
          (page) =>
            (!slug || (!Array.isArray(slug) && slug.equals === page.slug)) &&
            (!id || (!Array.isArray(id) && id.equals === page.id)),
        ),
      }
    },
  )
}

function routeArgs(slug: string, locale?: string) {
  return {
    params: Promise.resolve({ slug: slug.split('/') }),
    searchParams: Promise.resolve({ locale }),
  }
}

function mockHoldingPath(path: string) {
  mocks.headers.mockResolvedValue(
    new Headers({ [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1', [FRONTEND_PATH_HEADER]: `/${path}` }),
  )
}

describe('frontend CMS page route metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.draftMode.mockResolvedValue({ isEnabled: false })
    mocks.headers.mockResolvedValue(new Headers())
  })

  it('keeps an unavailable Full English home out of search and links to the German home', async () => {
    const { default: Page, generateMetadata } = await import('@/app/(frontend)/(pages)/[...slug]/page')
    findPages(false)
    const args = routeArgs('en')
    const html = renderToStaticMarkup(await Page(args))

    expect(html).toMatch(/<a[^>]+href="\/"/)
    expect((await generateMetadata(args)).robots).toEqual({ index: false, follow: false })
  })

  it('renders the published Full English CMS home with its own canonical', async () => {
    const { default: Page, generateMetadata } = await import('@/app/(frontend)/(pages)/[...slug]/page')
    findPages(true, { de: { ...germanPage, slug: 'home' }, en: { ...englishPage, slug: 'home' } })
    const args = routeArgs('en')

    const global = cloneBaselineLandingPages('en')
    global.home.hero.title = 'English CMS hero fixture'
    global.home.hero.image = { url: '/fixture-home-hero.png' } as typeof global.home.hero.image
    global.home.testimonials = []
    global.home.process.steps = []
    global.home.features.backgroundImage = global.home.hero.image
    mocks.findGlobal.mockResolvedValue(global)

    const markup = renderToStaticMarkup(await Page(args))
    expect(markup).toMatch(/<article[^>]+lang="en"/)
    expect(markup).toMatch(/<h1[^>]*>English CMS hero fixture<\/h1>/)
    expect(markup).toMatch(/href="\/en\/listing-comparison"/)
    const metadata = await generateMetadata(args)
    expect(metadata).toMatchObject({
      title: expect.stringContaining(englishPage.meta.title),
      alternates: { canonical: '/en', languages: { de: '/', en: '/en', 'x-default': '/' } },
    })
    expect(metadata.robots).not.toMatchObject({ index: false })
  })

  it.each(['imprint', 'privacy-policy'])(
    'serves each published Holding %s language and keeps it out of search',
    async (slug) => {
      const { default: Page, generateMetadata } = await import('@/app/(frontend)/(pages)/[...slug]/page')
      findPages(true, { de: { ...germanPage, slug }, en: { ...englishPage, slug } })

      for (const locale of ['de', 'en']) {
        const path = locale === 'de' ? slug : `en/${slug}`
        mockHoldingPath(path)
        const args = routeArgs(path)
        expect(renderToStaticMarkup(await Page(args))).toMatch(new RegExp(`<article[^>]+lang="${locale}"`))
        expect(await generateMetadata(args)).toMatchObject({
          alternates: { canonical: `/${path}` },
          robots: { index: false, follow: false },
        })
      }
    },
  )

  it.each(['imprint', 'privacy-policy'])('does not serve an unpublished English Holding %s rendition', async (slug) => {
    const { default: Page, generateMetadata } = await import('@/app/(frontend)/(pages)/[...slug]/page')
    findPages(false, { de: { ...germanPage, slug }, en: { ...englishPage, slug } })

    mockHoldingPath(`en/${slug}`)
    const args = routeArgs(`en/${slug}`)
    await expect(Page(args)).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    expect((await generateMetadata(args)).robots).toEqual({ index: false, follow: false })
  })

  it('links from the English Holding home to each published legal rendition', async () => {
    const { default: Page } = await import('@/app/(frontend)/(pages)/[...slug]/page')
    mockHoldingPath('en')
    mocks.find.mockImplementation(({ collection, locale }) => ({
      docs:
        collection === 'pages' ? [{ slug: 'imprint' }, ...(locale === 'de' ? [{ slug: 'privacy-policy' }] : [])] : [],
    }))

    const rendered = await Page(routeArgs('en'))
    const html = await new Promise<string>((resolve, reject) => {
      let markup = ''
      const output = new Writable({
        write(chunk, _encoding, complete) {
          markup += chunk.toString()
          complete()
        },
      }).on('finish', () => resolve(markup))
      const { pipe } = renderToPipeableStream(rendered, { onAllReady: () => pipe(output), onError: reject })
    })

    expect(
      Array.from(html.matchAll(/<a[^>]+href="(\/(?:en\/)?(?:imprint|privacy-policy))"[^>]*>([^<]*)<\/a>/g)).map(
        ([, path, label]) => ({ path, label }),
      ),
    ).toEqual([
      { path: '/privacy-policy', label: expect.stringMatching(/\(DE\)$/) },
      { path: '/en/imprint', label: expect.not.stringMatching(/\(DE\)$/) },
    ])
  })

  it('keeps the Turkish Holding introduction unavailable in Full', async () => {
    const { default: Page, generateMetadata } = await import('@/app/(frontend)/(pages)/[...slug]/page')
    const args = routeArgs('tr')

    await expect(Page(args)).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    expect((await generateMetadata(args)).robots).toEqual({ index: false, follow: false })
  })

  it.each([true, false])(
    'links directly to the published German Page with proxy source present=%s',
    async (hasSource) => {
      const { default: Page, generateMetadata } = await import('@/app/(frontend)/(pages)/[...slug]/page')

      findPages(false)
      if (hasSource) {
        mocks.headers.mockResolvedValue(new Headers({ 'x-fmd-cms-translation-source': '/pflege/deutschland' }))
      }
      const args = routeArgs('en/pflege/deutschland')
      const renderedPage = renderToStaticMarkup(await Page(args))

      expect(renderedPage).not.toContain('aria-label="Breadcrumb"')
      expect(renderedPage).toMatch(/<a[^>]+href="\/pflege\/deutschland"/)
      expect(await generateMetadata(args)).toEqual({
        title: expect.stringMatching(/\S/),
        robots: { index: false, follow: false },
      })
      mocks.headers.mockResolvedValue(new Headers())
      expect(await generateMetadata(routeArgs('en/unknown'))).not.toHaveProperty('title')
    },
  )

  it('only lists a published equivalent as a language alternate and keeps each canonical self-referential', async () => {
    const { generateMetadata } = await import('@/app/(frontend)/(pages)/[...slug]/page')

    findPages(false)
    const germanOnly = await generateMetadata(routeArgs('pflege/deutschland'))
    expect(germanOnly.alternates).toEqual({ canonical: '/pflege/deutschland' })

    findPages(true)
    const languages = { de: '/pflege/deutschland', en: '/en/care/germany', 'x-default': '/pflege/deutschland' }
    const german = await generateMetadata(routeArgs('pflege/deutschland', 'en'))
    const english = await generateMetadata(routeArgs('en/care/germany'))

    expect(german.alternates).toEqual({ canonical: '/pflege/deutschland', languages })
    expect(english.alternates).toEqual({ canonical: '/en/care/germany', languages })
  })
})
