import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Where } from 'payload'

const mocks = vi.hoisted(() => ({
  draftMode: vi.fn(),
  find: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('next/headers', () => ({ draftMode: mocks.draftMode, headers: mocks.headers }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: async () => ({ find: mocks.find }),
}))
vi.mock('@/app/(frontend)/_components/PayloadRedirects', () => ({ PayloadRedirects: () => null }))
vi.mock('@/blocks/RenderBlocks', () => ({ RenderBlocks: () => null }))
vi.mock('@/components/organisms/LivePreviewListener', () => ({ LivePreviewListener: () => null }))

const germanPage = { id: 4, slug: 'pflege/deutschland', meta: { title: 'German page' } }
const englishPage = { id: 4, slug: 'care/germany', meta: { title: 'English page' } }

function findPages(publishedEnglish: boolean) {
  mocks.find.mockImplementation(({ locale, where }: { locale: string; where: Where }) => {
    const candidates = locale === 'de' ? [germanPage] : publishedEnglish ? [englishPage] : []
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
  })
}

function routeArgs(slug: string, locale?: string) {
  return {
    params: Promise.resolve({ slug: slug.split('/') }),
    searchParams: Promise.resolve({ locale }),
  }
}

describe('frontend CMS page route metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.draftMode.mockResolvedValue({ isEnabled: false })
    mocks.headers.mockResolvedValue(new Headers())
  })

  it('links directly to the same German Page from a noindex English notice', async () => {
    const { default: Page, generateMetadata } = await import('@/app/(frontend)/(pages)/[...slug]/page')

    findPages(false)
    mocks.headers.mockResolvedValue(new Headers({ 'x-fmd-cms-translation-source': '/pflege/deutschland' }))
    const args = routeArgs('en/pflege/deutschland')
    const renderedPage = renderToStaticMarkup(await Page(args))

    expect(renderedPage).toMatch(/<h1[\s>]/)
    expect(renderedPage).toMatch(/<a[^>]+href="\/pflege\/deutschland"/)
    expect(await generateMetadata(args)).toEqual({ robots: { index: false, follow: false } })
  })

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
