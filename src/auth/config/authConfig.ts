/**
 * Authentication Configuration
 *
 * Centralized configuration for authentication system including
 * user types, collection mappings, and environment-specific settings.
 */

/**
 * Valid user types supported by the authentication system
 */
export const VALID_USER_TYPES = ['clinic', 'platform', 'patient'] as const
export type UserType = (typeof VALID_USER_TYPES)[number]

/**
 * User type to collection mapping configuration
 */
export const USER_CONFIG = {
  clinic: {
    collection: 'basicUsers' as const,
    profileCollection: 'clinicStaff' as const,
    requiresProfile: true,
    requiresApproval: true,
  },
  platform: {
    collection: 'basicUsers' as const,
    profileCollection: 'platformStaff' as const,
    requiresProfile: true,
    requiresApproval: false,
  },
  patient: {
    collection: 'patients' as const,
    profileCollection: null,
    requiresProfile: false,
    requiresApproval: false,
  },
} as const

/**
 * Get user configuration for a specific user type
 */
export function getUserConfig(userType: string) {
  if (!VALID_USER_TYPES.includes(userType as UserType)) {
    throw new Error(`Invalid user type: ${userType}`)
  }
  return USER_CONFIG[userType as UserType]
}
