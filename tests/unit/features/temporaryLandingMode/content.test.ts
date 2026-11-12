import { describe, expect, it } from 'vitest'

import {
  getTemporaryLandingPageContent,
  TEMPORARY_LANDING_LOCALES,
  type TemporaryLandingLocale,
} from '@/features/temporaryLandingMode'

describe('temporaryLandingMode content', () => {
  it('returns non-empty hero copy for every supported locale', () => {
    TEMPORARY_LANDING_LOCALES.forEach((locale) => {
      const content = getTemporaryLandingPageContent(locale)

      expect(content.eyebrow.trim().length).toBeGreaterThan(0)
      expect(content.title.trim().length).toBeGreaterThan(0)
      expect(content.description.trim().length).toBeGreaterThan(0)
      expect(content.heroVideo?.subheadlineText?.trim().length ?? 0).toBeGreaterThan(0)
    })
  })

  it('returns three benefit cards with localized copy for every locale', () => {
    TEMPORARY_LANDING_LOCALES.forEach((locale) => {
      const content = getTemporaryLandingPageContent(locale)

      expect(content.whatYouGetEyebrow?.trim().length ?? 0).toBeGreaterThan(0)
      expect(content.signals).toHaveLength(3)
      content.signals.forEach((signal) => {
        expect(signal.title.trim().length).toBeGreaterThan(0)
        expect(signal.body.trim().length).toBeGreaterThan(0)
      })
    })
  })

  it('falls back to english content for unsupported locale keys', () => {
    const invalidLocale = 'xx' as TemporaryLandingLocale
    const fallbackContent = getTemporaryLandingPageContent(invalidLocale)

    expect(fallbackContent.title).toBe(getTemporaryLandingPageContent('en').title)
    expect(fallbackContent.searchSnapshot.metaTitle).toBe(getTemporaryLandingPageContent('en').searchSnapshot.metaTitle)
  })
})
