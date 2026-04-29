import { describe, expect, it } from 'vitest'

import { resolveContentLocaleContext } from '@/utilities/contentLocalization'

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
