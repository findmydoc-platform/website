import type { UiCopyLocale } from './requestLocale'

export function clinicProfilePath(slug: string, locale: UiCopyLocale): string {
  return `${locale === 'en' ? '/en' : ''}/clinics/${encodeURIComponent(slug)}`
}

export function clinicProfileLocaleFromPath(pathname: string): UiCopyLocale | null {
  if (/^\/en\/clinics\/[^/]+\/?$/.test(pathname)) return 'en'
  if (/^\/clinics\/[^/]+\/?$/.test(pathname)) return 'de'
  return null
}
