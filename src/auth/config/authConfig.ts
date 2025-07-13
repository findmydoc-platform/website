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
 * Environment-specific configuration
 */
export const AUTH_CONFIG = {
  /**
   * JWT token expiration buffer (in seconds)
   * Tokens expiring within this buffer are considered invalid
   */
  JWT_EXPIRY_BUFFER: 60,
  
  /**
   * Maximum number of user lookup retries
   */
  MAX_LOOKUP_RETRIES: 3,
  
  /**
   * Default user creation timeout (in ms)
   */
  USER_CREATION_TIMEOUT: 10000,
  
  /**
   * Enable detailed authentication logging in development
   */
  ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
  
  /**
   * Required Supabase environment variables
   */
  REQUIRED_ENV_VARS: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_JWT_SECRET',
  ] as const,
} as const

/**
 * Validation helper to ensure all required environment variables are present
 */
export function validateAuthEnvironment(): boolean {
  return AUTH_CONFIG.REQUIRED_ENV_VARS.every(
    envVar => process.env[envVar] !== undefined
  )
}

/**
 * Get user configuration for a specific user type
 */
export function getUserConfig(userType: string) {
  if (!VALID_USER_TYPES.includes(userType as any)) {
    throw new Error(`Invalid user type: ${userType}`)
  }
  return USER_CONFIG[userType as keyof typeof USER_CONFIG]
}
