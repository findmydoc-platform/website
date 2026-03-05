const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const normalizeEmail = (email: string | null | undefined): string => {
  if (typeof email !== 'string') {
    return ''
  }

  return email.trim().toLowerCase()
}

export const isValidEmail = (email: string): boolean => EMAIL_PATTERN.test(email)
