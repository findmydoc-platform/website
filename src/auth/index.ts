/**
 * Authentication System Entry Point
 * 
 * Provides clean import paths for authentication utilities, types, and configuration.
 */

// Main authentication strategy
export { supabaseStrategy } from './strategies/supabaseStrategy'

// Configuration
export { 
  getUserConfig, 
  validateAuthEnvironment,
  USER_CONFIG,
  VALID_USER_TYPES,
  AUTH_CONFIG 
} from './config/authConfig'

// Types
export type {
  AuthData,
  UserResult,
  UserConfig,
  UserType
} from './types/authTypes'

// Core utilities - for advanced usage
export {
  extractSupabaseUserData,
  extractTokenFromHeader,
  validateSupabaseUser,
  transformSupabaseUser
} from './utilities/jwtValidation'

export {
  findUserBySupabaseId,
  isClinicUserApproved
} from './utilities/userLookup'

export {
  prepareUserData,
  createUser
} from './utilities/userCreation'

export {
  validateUserAccess,
  validateClinicAccess,
  validateUserTypePermissions
} from './utilities/accessValidation'
