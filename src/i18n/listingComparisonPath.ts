import type { UiCopyLocale } from './requestLocale'

export const LISTING_COMPARISON_PATHS = {
  de: '/listing-comparison',
  en: '/en/listing-comparison',
} satisfies Record<UiCopyLocale, string>

export function listingComparisonLocaleFromPath(pathname: string): UiCopyLocale | null {
  const path = pathname.replace(/\/$/, '')
  if (path === LISTING_COMPARISON_PATHS.de) return 'de'
  if (path === LISTING_COMPARISON_PATHS.en) return 'en'
  return null
}
