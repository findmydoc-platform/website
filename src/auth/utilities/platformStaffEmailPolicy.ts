import { normalizeEmail } from '@/auth/utilities/emailNormalization'

export const PLATFORM_STAFF_EMAIL_DOMAIN = 'findmydoc.eu'
export const PLATFORM_STAFF_EMAIL_REQUIREMENT_MESSAGE =
  'Platform staff accounts must use a @findmydoc.eu email address.'

export const isFindmydocPlatformEmail = (email: string | null | undefined): boolean => {
  const normalizedEmail = normalizeEmail(email)

  return normalizedEmail.endsWith(`@${PLATFORM_STAFF_EMAIL_DOMAIN}`)
}
