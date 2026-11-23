import { describe, expect, it } from 'vitest'

import { isReservedPageSlug, resolveContentLocaleContext } from '@/utilities/contentLocalization'

describe('resolveContentLocaleContext', () => {
  it('returns locale and english fallback for non-default locales', () => {
    expect(resolveContentLocaleContext('de')).toEqual({
      locale: 'de',
      fallbackLocale: 'en',
    })
  })

  it('returns an empty context for the default locale', () => {
    expect(resolveContentLocaleContext('en')).toEqual({})
  })

  it('returns an empty context for missing or invalid locale values', () => {
    expect(resolveContentLocaleContext(undefined)).toEqual({})
    expect(resolveContentLocaleContext(null)).toEqual({})
    expect(resolveContentLocaleContext('fr')).toEqual({})
    expect(resolveContentLocaleContext(['tr', 'de'])).toEqual({})
  })
})

describe('isReservedPageSlug', () => {
  it.each([
    ['de', 'en', true],
    ['de', 'en/team', true],
    ['de', 'english-team', false],
    ['en', 'posts/article', true],
    ['en', 'posts/page/2', false],
    ['en', 'listing-comparison', true],
    ['en', 'login/patient', true],
    ['en', 'register/patient', true],
    ['en', 'auth/password/reset', true],
    ['en', 'auth/password/help', false],
    [undefined, 'en/team', false],
  ] as const)('classifies %s slug %s consistently with outer slashes', (locale, slug, reserved) => {
    expect(isReservedPageSlug(slug, locale)).toBe(reserved)
    expect(isReservedPageSlug(`  //${slug}///  `, locale)).toBe(reserved)
  })

  it.each(['de', 'en'])('leaves empty and slash-only %s slugs unreserved', (locale) => {
    expect(isReservedPageSlug('', locale)).toBe(false)
    expect(isReservedPageSlug('  ///  ', locale)).toBe(false)
  })
})
