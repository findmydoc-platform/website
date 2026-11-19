import { PATIENT_LOGIN_PATH } from '@/features/favorites/redirects'
import { localizedPatientAuthPath } from '@/i18n/patientAuthPath'

export const UI_COPY_LOCALE_HEADER = 'x-findmydoc-ui-copy-locale'
export const ENGLISH_PATIENT_LOGIN_PATH = localizedPatientAuthPath(PATIENT_LOGIN_PATH, 'en')

const PATIENT_REGISTRATION_PATH = '/register/patient'
const ENGLISH_PATIENT_REGISTRATION_PATH = localizedPatientAuthPath(PATIENT_REGISTRATION_PATH, 'en')
const RECOVERY_REQUEST_PATH = '/auth/password/reset'
const ENGLISH_RECOVERY_REQUEST_PATH = localizedPatientAuthPath(RECOVERY_REQUEST_PATH, 'en')

export type UiCopyLocale = 'de' | 'en'

export function uiCopyLocaleFromPath(pathname: string): UiCopyLocale | null {
  const path = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (path === PATIENT_LOGIN_PATH || path === PATIENT_REGISTRATION_PATH || path === RECOVERY_REQUEST_PATH) return 'de'
  if (
    path === ENGLISH_PATIENT_LOGIN_PATH ||
    path === ENGLISH_PATIENT_REGISTRATION_PATH ||
    path === ENGLISH_RECOVERY_REQUEST_PATH
  ) {
    return 'en'
  }
  return null
}

export function uiCopyLocaleFromHeaders(headers: Headers): UiCopyLocale {
  return headers.get(UI_COPY_LOCALE_HEADER) === 'de' ? 'de' : 'en'
}
