import type { UiCopyLocale } from './requestLocale'

export const SAVED_CLINICS_SLUG = 'patient/favorites'

export const SAVED_CLINICS_PATHS = {
  de: `/${SAVED_CLINICS_SLUG}`,
  en: `/en/${SAVED_CLINICS_SLUG}`,
} satisfies Record<UiCopyLocale, string>

export function savedClinicsLocaleFromPath(pathname: string): UiCopyLocale | null {
  const path = pathname.replace(/\/$/, '')
  if (path === SAVED_CLINICS_PATHS.de) return 'de'
  if (path === SAVED_CLINICS_PATHS.en) return 'en'
  return null
}
