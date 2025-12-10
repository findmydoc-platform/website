/**
 * JWT validation and Supabase authentication utilities.
 * Handles token extraction and user data validation.
 */

import { createClient } from '@/auth/utilities/supaBaseServer'
import type { AuthData } from '@/auth/types/authTypes'
import { VALID_USER_TYPES } from '@/auth/config/authConfig'
import type { PayloadRequest } from 'payload'
import type { User } from '@supabase/supabase-js'

/**
 * Extracts Bearer token from Authorization header.
 * @param req - PayloadCMS request object
 * @returns The token string or undefined if not found
 */
export function extractTokenFromHeader(req?: PayloadRequest): string | undefined {
  if (!req?.headers) return undefined

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '')
  }

  return undefined
}

/**
 * Validates user data from Supabase response.
 * @param user - The user object from Supabase
 * @returns true if user data is valid, false otherwise
 */
export function validateSupabaseUser(user: User | null): boolean {
  if (!user?.id || !user?.email) {
    return false
  }

  const userType = user.app_metadata?.user_type
  if (!userType || !VALID_USER_TYPES.includes(userType)) {
    return false
  }

  return true
}

/**
 * Transforms Supabase user data into AuthData format.
 * @param user - The user object from Supabase
 * @returns AuthData object with user information
 */
export function transformSupabaseUser(user: User): AuthData {
  return {
    supabaseUserId: user.id,
    userEmail: user.email?.trim() || '',
    userType: user.app_metadata.user_type as 'clinic' | 'platform' | 'patient',
    firstName: user.user_metadata?.first_name?.trim() || '',
    lastName: user.user_metadata?.last_name?.trim() || '',
  }
}

/**
 * Extracts and validates user data from Supabase authentication.
 * Supports both header-based tokens (API calls) and cookie-based sessions (Admin UI).
 * @param req - PayloadCMS request object
 * @returns AuthData object or null if authentication fails
 */
export async function extractSupabaseUserData(req?: PayloadRequest): Promise<AuthData | null> {
  const supabaseClient = await createClient()
  const token = extractTokenFromHeader(req)

  try {
    let user: User | null

    if (token) {
      // Validate specific token (for API requests)
      const {
        data: { user: tokenUser },
        error,
      } = await supabaseClient.auth.getUser(token)
      if (error || !tokenUser) return null
      user = tokenUser
    } else {
      // Fallback to session-based authentication (for Admin UI)
      const {
        data: { user: sessionUser },
      } = await supabaseClient.auth.getUser()
      if (!sessionUser) return null
      user = sessionUser
    }

    // Validate user data
    if (!user || !validateSupabaseUser(user)) {
      return null
    }

    // Transform to AuthData format
    return transformSupabaseUser(user)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn('Failed to extract Supabase user data:', msg)
    return null
  }
}
