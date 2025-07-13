/**
 * JWT validation and Supabase authentication utilities.
 * Handles token extraction and user data validation.
 */

import { createClient } from '@/auth/utilities/supaBaseServer'
import type { AuthData } from '@/auth/types/authTypes'
import { VALID_USER_TYPES } from '@/auth/types/authTypes'

/**
 * Extracts Bearer token from Authorization header.
 * @param req - PayloadCMS request object
 * @returns The token string or undefined if not found
 */
export function extractTokenFromHeader(req?: any): string | undefined {
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
export function validateSupabaseUser(user: any): boolean {
  if (!user?.id || !user?.email) {
    console.warn('Missing required user fields', {
      hasId: !!user?.id,
      hasEmail: !!user?.email,
    })
    return false
  }

  const userType = user.app_metadata?.user_type
  if (!userType || !VALID_USER_TYPES.includes(userType)) {
    console.warn(`Invalid or missing user type: ${userType}`, {
      availableTypes: VALID_USER_TYPES,
    })
    return false
  }

  return true
}

/**
 * Transforms Supabase user data into AuthData format.
 * @param user - The user object from Supabase
 * @returns AuthData object with user information
 */
export function transformSupabaseUser(user: any): AuthData {
  return {
    supabaseUserId: user.id,
    userEmail: user.email.trim(),
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
export async function extractSupabaseUserData(req?: any): Promise<AuthData | null> {
  const supabaseClient = await createClient()
  const token = extractTokenFromHeader(req)

  try {
    let user

    if (token) {
      // Validate specific token (for API requests)
      const { data: { user: tokenUser }, error } = await supabaseClient.auth.getUser(token)
      if (error || !tokenUser) return null
      user = tokenUser
    } else {
      // Fallback to session-based authentication (for Admin UI)
      const { data: { user: sessionUser } } = await supabaseClient.auth.getUser()
      if (!sessionUser) return null
      user = sessionUser
    }

    // Validate user data
    if (!validateSupabaseUser(user)) {
      return null
    }

    // Transform to AuthData format
    return transformSupabaseUser(user)
  } catch (error: any) {
    console.warn('Failed to extract Supabase user data:', error.message)
    return null
  }
}
