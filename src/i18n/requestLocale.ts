import { blogArchiveLocaleFromPath } from '@/i18n/blogArchivePath'
import { contactLocaleFromPath } from '@/i18n/contactPath'
import { listingComparisonLocaleFromPath } from '@/i18n/listingComparisonPath'
import {
  AUTH_CONFIRMATION_PATH,
  PATIENT_LOGIN_PATH,
  PATIENT_LOGOUT_PATH,
  RECOVERY_COMPLETION_PATH,
  isLocalizedAuthConfirmationType,
  localizedPatientAuthPath,
} from '@/i18n/patientAuthPath'

export const FRONTEND_PATH_HEADER = 'x-findmydoc-frontend-path'
export const FRONTEND_PREVIEW_LOCALE_HEADER = 'x-findmydoc-frontend-preview-locale'
export const UI_COPY_LOCALE_HEADER = 'x-findmydoc-ui-copy-locale'
export const ENGLISH_PATIENT_LOGIN_PATH = localizedPatientAuthPath(PATIENT_LOGIN_PATH, 'en')

const ENGLISH_AUTH_CONFIRMATION_PATH = localizedPatientAuthPath(AUTH_CONFIRMATION_PATH, 'en')
const ENGLISH_PATIENT_LOGOUT_PATH = localizedPatientAuthPath(PATIENT_LOGOUT_PATH, 'en')
const ENGLISH_RECOVERY_COMPLETION_PATH = localizedPatientAuthPath(RECOVERY_COMPLETION_PATH, 'en')
const PATIENT_REGISTRATION_PATH = '/register/patient'
const ENGLISH_PATIENT_REGISTRATION_PATH = localizedPatientAuthPath(PATIENT_REGISTRATION_PATH, 'en')
const RECOVERY_REQUEST_PATH = '/auth/password/reset'
const ENGLISH_RECOVERY_REQUEST_PATH = localizedPatientAuthPath(RECOVERY_REQUEST_PATH, 'en')

export type UiCopyLocale = 'de' | 'en'

export function isAuthConfirmationPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '')
  return path === AUTH_CONFIRMATION_PATH || path === ENGLISH_AUTH_CONFIRMATION_PATH
}

export function patientAuthLocaleFromPath(
  pathname: string,
  searchParams?: Pick<URLSearchParams, 'getAll'> | null,
): UiCopyLocale | null {
  const path = pathname.replace(/\/$/, '')
  if (isAuthConfirmationPath(path)) {
    const types = searchParams?.getAll('type')
    const type = types?.length === 1 ? types[0] : undefined
    if (!isLocalizedAuthConfirmationType(type)) return null
    return path === ENGLISH_AUTH_CONFIRMATION_PATH ? 'en' : 'de'
  }

  if (path === RECOVERY_COMPLETION_PATH) return 'de'
  if (path === ENGLISH_RECOVERY_COMPLETION_PATH) return 'en'
  if (
    path === PATIENT_LOGIN_PATH ||
    path === PATIENT_LOGOUT_PATH ||
    path === PATIENT_REGISTRATION_PATH ||
    path === RECOVERY_REQUEST_PATH
  ) {
    return 'de'
  }
  if (
    path === ENGLISH_PATIENT_LOGIN_PATH ||
    path === ENGLISH_PATIENT_LOGOUT_PATH ||
    path === ENGLISH_PATIENT_REGISTRATION_PATH ||
    path === ENGLISH_RECOVERY_REQUEST_PATH
  ) {
    return 'en'
  }
  return null
}

export function uiCopyLocaleFromPath(
  pathname: string,
  searchParams?: Pick<URLSearchParams, 'getAll'> | null,
): UiCopyLocale | null {
  return (
    blogArchiveLocaleFromPath(pathname) ??
    contactLocaleFromPath(pathname) ??
    listingComparisonLocaleFromPath(pathname) ??
    patientAuthLocaleFromPath(pathname, searchParams)
  )
}

export function uiCopyLocaleFromHeaders(headers: Headers): UiCopyLocale {
  return headers.get(UI_COPY_LOCALE_HEADER) === 'de' ? 'de' : 'en'
}
