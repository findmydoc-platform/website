import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'

export const PATIENT_LOGIN_PATH = '/login/patient'
export const PATIENT_LOGIN_FALLBACK_PATH = '/'

export function buildPatientLoginHref(nextPath: string): string {
  const safeNextPath = sanitizeInternalRedirectPath({
    nextPath,
    fallbackPath: PATIENT_LOGIN_FALLBACK_PATH,
    blockedPaths: [PATIENT_LOGIN_PATH],
  })

  const params = new URLSearchParams({ next: safeNextPath })
  return `${PATIENT_LOGIN_PATH}?${params.toString()}`
}
