/**
 * JWT validation and Supabase authentication utilities.
 * Handles token extraction and user data validation.
 */

import { createClient } from '@/auth/utilities/supaBaseServer'
import type { AuthData } from '@/auth/types/authTypes'
import { VALID_USER_TYPES } from '@/auth/config/authConfig'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { getSupabaseLogger } from './supabaseLogger'
import type { User } from '@supabase/supabase-js'
import { hashLogValue, toLoggedError, type ServerLogger } from '@/utilities/logging/shared'

/**
 * Extracts Bearer token from Authorization header.
 * @param headers - Request headers
 * @returns The token string or undefined if not found
 */
export function extractTokenFromHeader(headers?: Headers): string | undefined {
  if (!headers) return undefined

  const authHeader = headers.get('authorization') || headers.get('Authorization')
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
    userEmail: normalizeEmail(user.email),
    userType: user.app_metadata.user_type as 'clinic' | 'platform' | 'patient',
    firstName: user.user_metadata?.first_name?.trim() || '',
    lastName: user.user_metadata?.last_name?.trim() || '',
  }
}

/**
 * Extracts and validates user data from Supabase authentication.
 * Supports both header-based tokens (API calls) and cookie-based sessions (Admin UI).
 * @param headers - Request headers
 * @returns AuthData object or null if authentication fails
 */
export async function extractSupabaseUserData({
  headers,
  logger,
}: {
  headers?: Headers
  logger?: ServerLogger
} = {}): Promise<AuthData | null> {
  const token = extractTokenFromHeader(headers)
  const activeLogger = await getSupabaseLogger({ headers, logger })

  try {
    const supabaseClient = await createClient()
    let user: User | null

    if (token) {
      // Validate specific token (for API requests)
      const {
        data: { user: tokenUser },
        error,
      } = await supabaseClient.auth.getUser(token)
      if (error) {
        activeLogger.warn(
          {
            event: 'auth.supabase.token.invalid',
            err: error,
          },
          'Supabase bearer token validation failed',
        )
      }
      if (error || !tokenUser) return null
      user = tokenUser
    } else {
      // Fallback to session-based authentication (for Admin UI)
      const {
        data: { user: sessionUser },
        error,
      } = await supabaseClient.auth.getUser()

      if (error) {
        activeLogger.warn(
          {
            event: 'auth.supabase.session.invalid',
            err: error,
          },
          'Supabase session validation failed',
        )
      }

      if (!sessionUser) {
        activeLogger.debug(
          {
            event: 'auth.supabase.session.missing',
          },
          'No Supabase session user found',
        )
        return null
      }
      user = sessionUser
    }

    // Validate user data
    if (!user || !validateSupabaseUser(user)) {
      activeLogger.warn(
        {
          event: 'auth.supabase.user.invalid',
          supabaseUserId: user?.id,
          userEmailHash: user?.email ? hashLogValue(user.email) : undefined,
        },
        'Supabase user payload is missing required fields',
      )
      return null
    }

    // Transform to AuthData format
    return transformSupabaseUser(user)
  } catch (error: unknown) {
    activeLogger.error(
      {
        err: toLoggedError(error),
        event: 'auth.supabase.extract.failed',
      },
      'Failed to extract Supabase user data',
    )
    return null
  }
}
