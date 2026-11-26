import type { UiCopyLocale } from '@/i18n/requestLocale'

export function authCopySentences(message: string, locale: UiCopyLocale) {
  return Array.from(new Intl.Segmenter(locale, { granularity: 'sentence' }).segment(message), ({ segment }) =>
    segment.trim(),
  )
}
