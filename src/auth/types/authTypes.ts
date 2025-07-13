/**
 * Shared type definitions for Supabase authentication strategy.
 * Contains interfaces and types used across authentication utilities.
 */

/**
 * AuthData interface representing the user data extracted from Supabase session.
 * Contains Supabase User ID, email, user type, and optional first/last names.
 */
export interface AuthData {
  supabaseUserId: string
  userEmail: string
  userType: 'clinic' | 'platform' | 'patient'
  firstName?: string
  lastName?: string
}

/**
 * Result type for user creation or lookup.
 * Contains the user document and the collection it belongs to.
 */
export interface UserResult {
  user: any
  collection: string
}

/**
 * UserConfig interface for collection configuration.
 */
export interface UserConfig {
  collection: string
  profile: string | null
  label: string
}

/**
 * Configuration for user types and their corresponding collections and profiles.
 * - clinic: BasicUsers collection, clinicStaff profile
 * - platform: BasicUsers collection, platformStaff profile
 * - patient: patients collection, no profile
 */
export const USER_CONFIG = {
  clinic: {
    collection: 'basicUsers',
    profile: 'clinicStaff',
    label: 'Clinic User',
  },
  platform: {
    collection: 'basicUsers',
    profile: 'platformStaff',
    label: 'Platform User',
  },
  patient: {
    collection: 'patients',
    profile: null,
    label: 'Patient',
  },
} as const

/**
 * Valid user types supported by the system.
 */
export const VALID_USER_TYPES = ['clinic', 'platform', 'patient'] as const

/**
 * Type for valid user types.
 */
export type UserType = typeof VALID_USER_TYPES[number]
