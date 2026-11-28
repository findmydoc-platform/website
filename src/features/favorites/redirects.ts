import { PATIENT_LOGIN_PATH, localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { sanitizeInternalRedirectPathOrNull } from '@/utilities/routing/sanitizeInternalRedirectPath'

export const PATIENT_LOGIN_HOME_PATHS = { de: '/', en: '/en' } satisfies Record<UiCopyLocale, string>

export function sanitizePatientLoginNext(nextPath: string | null): string | null {
  return sanitizeInternalRedirectPathOrNull({
    nextPath,
    blockedPaths: [PATIENT_LOGIN_PATH, localizedPatientAuthPath(PATIENT_LOGIN_PATH, 'en')],
  })
}

export function buildPatientLoginHref(nextPath: string, locale: UiCopyLocale = 'de'): string {
  const safeNextPath = sanitizePatientLoginNext(nextPath) ?? PATIENT_LOGIN_HOME_PATHS[locale]
  const params = new URLSearchParams({ next: safeNextPath })
  return `${localizedPatientAuthPath(PATIENT_LOGIN_PATH, locale)}?${params.toString()}`
}
