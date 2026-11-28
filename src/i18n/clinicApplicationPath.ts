import type { UiCopyLocale } from './requestLocale'

export const CLINIC_APPLICATION_PATHS = {
  de: '/register/clinic',
  en: '/en/register/clinic',
} as const satisfies Record<UiCopyLocale, string>

export function clinicApplicationLocaleFromPath(pathname: string): UiCopyLocale | null {
  const path = pathname.replace(/\/$/, '')
  if (path === CLINIC_APPLICATION_PATHS.de) return 'de'
  if (path === CLINIC_APPLICATION_PATHS.en) return 'en'
  return null
}
