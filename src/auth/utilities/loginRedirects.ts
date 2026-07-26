export const PATIENT_LOGIN_PATH = '/login/patient'
export const STAFF_LOGIN_PATH = '/admin/login'

export type PasswordResetLoginTarget = {
  href: string
}

export function resolvePasswordResetLoginTarget(userType: unknown, clinicLoginHref?: string): PasswordResetLoginTarget {
  const normalizedUserType = typeof userType === 'string' ? userType.trim().toLowerCase() : ''

  if (normalizedUserType === 'clinic') {
    if (!clinicLoginHref) {
      throw new Error('Clinic dashboard login target is required for clinic users')
    }
    return { href: clinicLoginHref }
  }

  if (normalizedUserType === 'platform' || normalizedUserType === 'staff') {
    return { href: STAFF_LOGIN_PATH }
  }

  return { href: PATIENT_LOGIN_PATH }
}
