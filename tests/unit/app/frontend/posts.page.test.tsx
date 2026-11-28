// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ archive: vi.fn(), headers: vi.fn() }))

vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next-intl/server', () => ({
  getTranslations:
    async ({ locale }: { locale: string }) =>
    (key: string) =>
      `${locale} ${key} fixture`,
}))
vi.mock('@/utilities/content/serverData', () => ({ getCachedPostArchivePage: mocks.archive }))
vi.mock('@/features/languageSwitch/LanguageSwitchRouteProvider.client', () => ({
  LanguageSwitchRoute: () => null,
}))

const germanPage = () => import('@/app/(frontend)/posts/page')
const englishPage = () => import('@/app/(frontend)/en/posts/page')

describe('localized blog archives', () => {
  beforeEach(() => {
    mocks.headers.mockResolvedValue(new Headers())
    mocks.archive.mockImplementation(({ preferredLocale }: { preferredLocale: string }) =>
      Promise.resolve({
        docs: [
          {
            post: { id: 1, slug: 'fixture-de', title: 'Article one fixture' },
            locale: 'de',
            canonicalPath: '/posts/fixture-de',
          },
          {
            post: { id: 2, slug: 'fixture-en', title: 'Article two fixture' },
            locale: 'en',
            canonicalPath: '/en/posts/fixture-en',
          },
          {
            post: {
              id: 3,
              slug: `fixture-pair-${preferredLocale}`,
              title: `Paired article fixture (${preferredLocale})`,
            },
            locale: preferredLocale,
            canonicalPath: preferredLocale === 'en' ? '/en/posts/fixture-pair-en' : '/posts/fixture-pair-de',
          },
        ],
        totalDocs: 13,
        totalPages: 2,
        page: 1,
      }),
    )
  })
  afterEach(cleanup)

  it.each([
    { page: germanPage, locale: 'de', other: 'en', fallback: 'Article two fixture', next: '/posts/page/2' },
    { page: englishPage, locale: 'en', other: 'de', fallback: 'Article one fixture', next: '/en/posts/page/2' },
  ])('shows articles and navigation in the $locale archive', async ({ page, locale, other, fallback, next }) => {
    const route = await page()
    render(await route.default())

    const heading = screen.getByRole('heading', { level: 1, name: `${locale} archive.title fixture` })
    expect(heading.closest('[lang]')).toHaveAttribute('lang', locale)
    expect(screen.getByRole('link', { name: 'Article one fixture' })).toHaveAttribute('href', '/posts/fixture-de')
    expect(screen.getByRole('link', { name: 'Article two fixture' })).toHaveAttribute('href', '/en/posts/fixture-en')
    expect(screen.getByRole('link', { name: `Paired article fixture (${locale})` })).toHaveAttribute(
      'href',
      locale === 'en' ? '/en/posts/fixture-pair-en' : '/posts/fixture-pair-de',
    )
    const fallbackLink = screen.getByRole('link', { name: fallback })
    expect(fallbackLink).toHaveAttribute('hreflang', other)
    expect(fallbackLink).toHaveAccessibleDescription(`${locale} archive.language.${other} fixture`)

    const pages = screen.getByRole('navigation', { name: `${locale} archive.pagination.navigation fixture` })
    expect(within(pages).getByRole('link', { name: `${locale} archive.pagination.nextLabel fixture` })).toHaveAttribute(
      'href',
      next,
    )
  })

  it('gives Full archive equivalents self-canonicals and reciprocal language alternatives', async () => {
    const de = await (await germanPage()).generateMetadata()
    const en = await (await englishPage()).generateMetadata()
    const languages = { de: '/posts', en: '/en/posts', 'x-default': '/posts' }

    expect(de.alternates).toEqual({ canonical: '/posts', languages })
    expect(en.alternates).toEqual({ canonical: '/en/posts', languages })
    expect(de.robots).toBeUndefined()
    expect(en.robots).toBeUndefined()
    expect(de.title).toContain('de metadataTitle fixture')
    expect(en.title).toContain('en metadataTitle fixture')
  })

  it('keeps the English archive out of the Holding alternate set and marks it noindex', async () => {
    mocks.headers.mockResolvedValue(new Headers({ 'x-public-site-mode': 'holding' }))
    const de = await (await germanPage()).generateMetadata()
    const en = await (await englishPage()).generateMetadata()

    expect(de.alternates).toEqual({ canonical: '/posts' })
    expect(de.robots).toBeUndefined()
    expect(en.alternates).toEqual({ canonical: '/en/posts' })
    expect(en.robots).toMatchObject({ index: false })
  })

  it('canonically consolidates the old locale query with the path language', async () => {
    const route = await germanPage()
    const metadata = await route.generateMetadata({ searchParams: Promise.resolve({ locale: 'en' }) })

    expect(metadata.alternates).toEqual({ canonical: '/posts' })
    expect(metadata.robots).toMatchObject({ index: false })
  })

  it('uses the English canonical and page metadata on page two', async () => {
    const route = await import('@/app/(frontend)/en/posts/page/[pageNumber]/page')
    const metadata = await route.generateMetadata({ params: Promise.resolve({ pageNumber: '2' }) })

    expect(metadata.alternates).toEqual({
      canonical: '/en/posts/page/2',
      languages: { de: '/posts/page/2', en: '/en/posts/page/2', 'x-default': '/posts/page/2' },
    })
    expect(metadata.title).toContain('en pagination.metadataTitle fixture')
  })

  it('exposes a localized empty archive state', async () => {
    mocks.archive.mockResolvedValueOnce({ docs: [], totalDocs: 0, totalPages: 0, page: 1 })
    const route = await englishPage()
    render(await route.default())

    const empty = screen.getByRole('region', { name: 'en archive.emptyTitle fixture' })
    expect(within(empty).getByText('en archive.emptyDescription fixture')).toBeVisible()
  })
})
