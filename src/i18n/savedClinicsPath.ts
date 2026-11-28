import type { UiCopyLocale } from './requestLocale'

export const SAVED_CLINICS_PATHS = {
  de: '/patient/favorites',
  en: '/en/patient/favorites',
} satisfies Record<UiCopyLocale, string>

export function savedClinicsLocaleFromPath(pathname: string): UiCopyLocale | null {
  const path = pathname.replace(/\/$/, '')
  if (path === SAVED_CLINICS_PATHS.de) return 'de'
  if (path === SAVED_CLINICS_PATHS.en) return 'en'
  return null
}
