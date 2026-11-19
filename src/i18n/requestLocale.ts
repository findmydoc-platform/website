import { PATIENT_LOGIN_PATH } from '@/features/favorites/redirects'

export const UI_COPY_LOCALE_HEADER = 'x-findmydoc-ui-copy-locale'
export const ENGLISH_PATIENT_LOGIN_PATH = `/en${PATIENT_LOGIN_PATH}`

export type UiCopyLocale = 'de' | 'en'

export function patientLoginLocaleFromPath(pathname: string): UiCopyLocale | null {
  const path = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (path === PATIENT_LOGIN_PATH) return 'de'
  if (path === ENGLISH_PATIENT_LOGIN_PATH) return 'en'
  return null
}

export function patientLoginLocaleFromHeaders(headers: Headers): UiCopyLocale {
  return headers.get(UI_COPY_LOCALE_HEADER) === 'de' ? 'de' : 'en'
}
