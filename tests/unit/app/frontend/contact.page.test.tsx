import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as GermanContactPage from '@/app/(frontend)/contact/page'
import * as EnglishContactPage from '@/app/(frontend)/en/contact/page'

const { headers } = vi.hoisted(() => ({ headers: vi.fn(async () => new Headers()) }))

vi.mock('next/headers', () => ({ headers }))

vi.mock('@/features/uiCopy/publicContact', () => ({
  publicContactCopy: async (locale: string) => ({
    title: `Fixture ${locale}`,
    description: `Fixture description ${locale}`,
  }),
}))

vi.mock('@/features/contactRequests/LocalizedPublicContactSection', () => ({
  LocalizedPublicContactSection: ({ locale }: { locale: string }) => <h1 lang={locale}>Fixture</h1>,
}))

vi.mock('@/features/languageSwitch/LanguageSwitchRouteProvider.client', () => ({
  LanguageSwitchRoute: () => null,
}))

describe('localized contact routes', () => {
  beforeEach(() => {
    headers.mockReset()
    headers.mockResolvedValue(new Headers())
  })

  it.each([
    [GermanContactPage, 'de', '/contact'],
    [EnglishContactPage, 'en', '/en/contact'],
  ] as const)('renders a locale-specific form and metadata for %s', async (route, locale, canonical) => {
    const metadata = await route.generateMetadata()
    expect(metadata).toMatchObject({
      description: `Fixture description ${locale}`,
      alternates: { canonical, languages: { de: '/contact', en: '/en/contact', 'x-default': '/contact' } },
    })
    const page = await route.default({})
    expect(renderToStaticMarkup(page)).toContain(`<h1 lang="${locale}">`)
  })

  it('marks Holding contact metadata as excluded from indexing', async () => {
    headers.mockResolvedValue(new Headers({ 'x-temporary-landing-mode': '1' }))

    expect(await EnglishContactPage.generateMetadata()).toMatchObject({
      robots: { index: false, follow: false },
      alternates: { canonical: '/en/contact' },
    })
  })

  it('preserves only safe attribution values through the contact section and locale targets', async () => {
    const page = await GermanContactPage.default({
      searchParams: Promise.resolve({
        clinic: [' berlin-health-clinic ', 'ignored-second-value'],
        source: 'https://tracker.example/campaign',
        ignored: 'not-forwarded',
      }),
    })

    const [languageSwitcher, section] = page.props.children
    expect(section.props.submissionMetadata).toEqual({ clinic: 'berlin-health-clinic' })
    expect(languageSwitcher.props.targets).toEqual({
      de: '/contact?clinic=berlin-health-clinic',
      en: '/en/contact?clinic=berlin-health-clinic',
    })
  })
})
