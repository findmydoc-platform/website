import { describe, expect, it } from 'vitest'

import {
  buildTemporaryLandingLanguageOptions,
  buildTemporaryLandingLocaleHref,
  getTemporaryLandingPageContent,
  resolveTemporaryLandingLocale,
  TEMPORARY_LANDING_LOCALES,
  type TemporaryLandingLocale,
} from '@/features/temporaryLandingMode'

describe('temporaryLandingMode i18n', () => {
  it('resolves supported locales and falls back to english', () => {
    expect(resolveTemporaryLandingLocale(undefined)).toBe('en')
    expect(resolveTemporaryLandingLocale({})).toBe('en')
    expect(resolveTemporaryLandingLocale({ lang: 'de' })).toBe('de')
    expect(resolveTemporaryLandingLocale({ lang: 'TR' })).toBe('tr')
    expect(resolveTemporaryLandingLocale({ lang: 'foo' })).toBe('en')
  })

  it('resolves locale from first array search param entry', () => {
    expect(resolveTemporaryLandingLocale({ lang: ['tr', 'de'] })).toBe('tr')
  })

  it('builds locale href while preserving other query params', () => {
    expect(buildTemporaryLandingLocaleHref('tr', { foo: 'bar' })).toBe('/?foo=bar&lang=tr')
    expect(buildTemporaryLandingLocaleHref('de', { foo: ['bar', 'baz'], lang: 'en' })).toBe('/?foo=bar&foo=baz&lang=de')
    expect(buildTemporaryLandingLocaleHref('en', undefined)).toBe('/?lang=en')
  })

  it('builds language options with locale specific hrefs', () => {
    const options = buildTemporaryLandingLanguageOptions({ source: 'hero', lang: 'en' })

    expect(options).toEqual([
      { value: 'en', label: 'EN', href: '/?source=hero&lang=en' },
      { value: 'de', label: 'DE', href: '/?source=hero&lang=de' },
      { value: 'tr', label: 'TR', href: '/?source=hero&lang=tr' },
    ])
  })

  it('returns localized content for every supported locale', () => {
    const byLocale = TEMPORARY_LANDING_LOCALES.reduce(
      (accumulator, locale) => {
        accumulator[locale] = getTemporaryLandingPageContent(locale)
        return accumulator
      },
      {} as Record<TemporaryLandingLocale, ReturnType<typeof getTemporaryLandingPageContent>>,
    )

    expect(byLocale.en.contactTitle).toBe('Contact us')
    expect(byLocale.de.contactTitle).toBe('Kontaktiere uns')
    expect(byLocale.tr.contactTitle).toBe('Bize ulaşın')

    TEMPORARY_LANDING_LOCALES.forEach((locale) => {
      const content = byLocale[locale]
      expect(content.title.length).toBeGreaterThan(0)
      expect(content.whySectionHeading?.length ?? 0).toBeGreaterThan(0)
      expect(content.heroVideo?.subheadlineText?.length ?? 0).toBeGreaterThan(0)
      expect(content.contactFormLabels?.emailPlaceholder.length ?? 0).toBeGreaterThan(0)
    })
  })

  it('falls back to english content for unknown locale keys', () => {
    const invalidLocale = 'xx' as TemporaryLandingLocale
    const fallbackContent = getTemporaryLandingPageContent(invalidLocale)

    expect(fallbackContent.contactTitle).toBe('Contact us')
    expect(fallbackContent.footerLinks.map((link) => link.label)).toEqual(['Privacy Policy', 'Imprint'])
  })
})
