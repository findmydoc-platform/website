import { normalizeEmail } from '@/auth/utilities/emailNormalization'

const PLATFORM_STAFF_EMAIL_DOMAIN = 'findmydoc.eu'

export const isFindmydocPlatformEmail = (email: string | null | undefined): boolean => {
  const normalizedEmail = normalizeEmail(email)

  return normalizedEmail.endsWith(`@${PLATFORM_STAFF_EMAIL_DOMAIN}`)
}
