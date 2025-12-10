/**
 * Shared type definitions for Supabase authentication strategy.
 * Contains interfaces and types used across authentication utilities.
 */

import { VALID_USER_TYPES } from '../config/authConfig'
import type { BasicUser, Patient } from '@/payload-types'

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
  user: BasicUser | Patient
  collection: 'basicUsers' | 'patients'
}

/**
 * UserConfig interface for collection configuration.
 */
export interface UserConfig {
  collection: 'basicUsers' | 'patients'
  profileCollection: 'clinicStaff' | 'platformStaff' | null
  requiresProfile: boolean
  requiresApproval: boolean
}

/**
 * Type for valid user types.
 */
export type UserType = (typeof VALID_USER_TYPES)[number]
