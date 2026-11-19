import type { UiCopyLocale } from '@/i18n/requestLocale'

type PatientAuthPath =
  '/auth/confirm' | '/auth/password/reset' | '/auth/password/reset/complete' | '/login/patient' | '/register/patient'

export function localizedPatientAuthPath(path: PatientAuthPath, locale: UiCopyLocale) {
  return locale === 'en' ? `/en${path}` : path
}
