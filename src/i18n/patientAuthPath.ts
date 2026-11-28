import type { UiCopyLocale } from '@/i18n/requestLocale'

export const AUTH_CONFIRMATION_PATH = '/auth/confirm'
export const PATIENT_LOGIN_PATH = '/login/patient'
export const PATIENT_LOGOUT_PATH = '/logout'
export const RECOVERY_COMPLETION_PATH = '/auth/password/reset/complete'

const englishPatientAuthPaths = {
  [AUTH_CONFIRMATION_PATH]: '/auth/en/confirm',
  [RECOVERY_COMPLETION_PATH]: '/auth/en/password/reset/complete',
  '/auth/password/reset': '/en/auth/password/reset',
  [PATIENT_LOGIN_PATH]: '/en/login/patient',
  [PATIENT_LOGOUT_PATH]: '/en/logout',
  '/register/patient': '/en/register/patient',
} as const

type PatientAuthPath = keyof typeof englishPatientAuthPaths
export type LocalizedAuthConfirmationType = 'patient-verification' | 'recovery'

export function isLocalizedAuthConfirmationType(type: unknown): type is LocalizedAuthConfirmationType {
  return type === 'patient-verification' || type === 'recovery'
}

export function localizedPatientAuthPath(path: PatientAuthPath, locale: UiCopyLocale) {
  return locale === 'en' ? englishPatientAuthPaths[path] : path
}
