import { describe, expect, it } from 'vitest'

import {
  buildTemporaryLandingLanguageOptions,
  buildTemporaryLandingLocaleHref,
  getTemporaryLandingPageContent,
  resolveTemporaryLandingContentLocale,
  temporaryLandingLocaleFromPath,
  TEMPORARY_LANDING_LOCALES,
  type TemporaryLandingLocale,
} from '@/features/temporaryLandingMode'

describe('temporaryLandingMode i18n', () => {
  it('resolves only the exact Holding paths to a language', () => {
    expect(temporaryLandingLocaleFromPath('/')).toBe('de')
    expect(temporaryLandingLocaleFromPath('/en')).toBe('en')
    expect(temporaryLandingLocaleFromPath('/tr/')).toBe('tr')
    expect(temporaryLandingLocaleFromPath('/tr/other')).toBeNull()
  })

  it('builds locale href while preserving other query params', () => {
    expect(buildTemporaryLandingLocaleHref('tr', { foo: 'bar' })).toBe('/tr?foo=bar')
    expect(buildTemporaryLandingLocaleHref('de', { foo: ['bar', 'baz'], lang: 'en' })).toBe('/?foo=bar&foo=baz')
    expect(buildTemporaryLandingLocaleHref('en', undefined)).toBe('/en')
  })

  it('builds language options with locale specific hrefs', () => {
    const options = buildTemporaryLandingLanguageOptions({ source: 'hero', lang: 'en' })

    expect(options).toEqual([
      { value: 'en', label: 'EN', href: '/en?source=hero' },
      { value: 'de', label: 'DE', href: '/?source=hero' },
      { value: 'tr', label: 'TR', href: '/tr?source=hero' },
    ])
  })

  it('maps holding locales to supported blog content locales', () => {
    expect(resolveTemporaryLandingContentLocale('en')).toEqual({})
    expect(resolveTemporaryLandingContentLocale('de')).toEqual({ locale: 'de', fallbackLocale: 'en' })
    expect(resolveTemporaryLandingContentLocale('tr')).toEqual({})
  })

  it('returns localized content for every supported locale', () => {
    const byLocale = TEMPORARY_LANDING_LOCALES.reduce(
      (accumulator, locale) => {
        accumulator[locale] = getTemporaryLandingPageContent(locale)
        return accumulator
      },
      {} as Record<TemporaryLandingLocale, ReturnType<typeof getTemporaryLandingPageContent>>,
    )

    TEMPORARY_LANDING_LOCALES.forEach((locale) => {
      const content = byLocale[locale]
      if (locale !== 'en') {
        expect(content).not.toEqual(byLocale.en)
      }
      expect(content.title.length).toBeGreaterThan(0)
      expect(content.whySectionHeading?.length ?? 0).toBeGreaterThan(0)
      expect(content.heroVideo?.subheadlineText?.length ?? 0).toBeGreaterThan(0)
      expect(content.contactFormLabels?.emailPlaceholder.length ?? 0).toBeGreaterThan(0)
    })
  })

  it('falls back to German content for unknown locale keys', () => {
    const invalidLocale = 'xx' as TemporaryLandingLocale
    const fallbackContent = getTemporaryLandingPageContent(invalidLocale)

    const defaultContent = getTemporaryLandingPageContent('de')
    expect(fallbackContent).toEqual(defaultContent)
  })
})
