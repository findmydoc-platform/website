export const PATIENT_LOGIN_PATH = '/login/patient'
export const STAFF_LOGIN_PATH = '/admin/login'

export type PasswordResetLoginTarget = {
  href: typeof PATIENT_LOGIN_PATH | typeof STAFF_LOGIN_PATH
}

export function resolvePasswordResetLoginTarget(userType: unknown): PasswordResetLoginTarget {
  const normalizedUserType = typeof userType === 'string' ? userType.trim().toLowerCase() : ''

  if (normalizedUserType === 'clinic' || normalizedUserType === 'platform' || normalizedUserType === 'staff') {
    return { href: STAFF_LOGIN_PATH }
  }

  return { href: PATIENT_LOGIN_PATH }
}
