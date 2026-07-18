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

type SupabaseAuthErrorLike = {
  code?: string
  message?: string
  name?: string
  status?: number
}

export type SupabaseBearerValidationResult =
  { status: 'authenticated'; authData: AuthData } | { status: 'invalid' } | { status: 'unavailable' }

const isTemporarySupabaseError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const authError = error as SupabaseAuthErrorLike
  const normalizedMessage = authError.message?.toLowerCase() ?? ''

  return (
    authError.name === 'AuthRetryableFetchError' ||
    authError.status === 0 ||
    authError.status === 429 ||
    (typeof authError.status === 'number' && authError.status >= 500) ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network error') ||
    normalizedMessage.includes('timed out')
  )
}

const isExpectedMissingSessionError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const authError = error as SupabaseAuthErrorLike
  const normalizedMessage = authError.message?.toLowerCase() ?? ''

  return (
    authError.name === 'AuthSessionMissingError' ||
    authError.code === 'refresh_token_not_found' ||
    normalizedMessage.includes('auth session missing') ||
    normalizedMessage.includes('refresh token not found')
  )
}

/**
 * Extracts Bearer token from Authorization header.
 * @param headers - Request headers
 * @returns The token string or undefined if not found
 */
export function extractTokenFromHeader(headers?: Headers): string | undefined {
  if (!headers) return undefined

  const authHeader = headers.get('authorization') || headers.get('Authorization')
  if (!authHeader) return undefined

  const [scheme, ...rest] = authHeader.trim().split(/\s+/)
  if (scheme?.toLowerCase() !== 'bearer' || rest.length !== 1) return undefined

  return rest[0]
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
 * Validates one explicit Supabase Bearer token without consulting cookie state.
 */
export async function validateSupabaseBearerToken({
  token,
  headers,
  logger,
}: {
  token: string
  headers?: Headers
  logger?: ServerLogger
}): Promise<SupabaseBearerValidationResult> {
  const activeLogger = await getSupabaseLogger({ headers, logger })

  try {
    const supabaseClient = await createClient()
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser(token)

    if (error) {
      const unavailable = isTemporarySupabaseError(error)
      activeLogger[unavailable ? 'error' : 'warn'](
        {
          event: unavailable ? 'auth.supabase.token.unavailable' : 'auth.supabase.token.invalid',
          err: error,
        },
        unavailable ? 'Supabase bearer validation is temporarily unavailable' : 'Supabase bearer token is invalid',
      )
      return { status: unavailable ? 'unavailable' : 'invalid' }
    }

    if (!user || !validateSupabaseUser(user)) {
      activeLogger.warn(
        {
          event: 'auth.supabase.user.invalid',
          supabaseUserIdHash: user?.id ? hashLogValue(user.id) : undefined,
          userEmailHash: user?.email ? hashLogValue(user.email) : undefined,
        },
        'Supabase user payload is missing required fields',
      )
      return { status: 'invalid' }
    }

    return { status: 'authenticated', authData: transformSupabaseUser(user) }
  } catch (error: unknown) {
    activeLogger.error(
      {
        err: toLoggedError(error),
        event: 'auth.supabase.token.unavailable',
      },
      'Supabase bearer validation is temporarily unavailable',
    )
    return { status: 'unavailable' }
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
    let user: User | null

    if (token) {
      const result = await validateSupabaseBearerToken({ token, headers, logger: activeLogger })
      return result.status === 'authenticated' ? result.authData : null
    } else {
      // Fallback to session-based authentication (for Admin UI)
      const supabaseClient = await createClient()
      const {
        data: { user: sessionUser },
        error,
      } = await supabaseClient.auth.getUser()

      if (error) {
        const logPayload = {
          event: 'auth.supabase.session.invalid',
          err: error,
        }

        if (isExpectedMissingSessionError(error)) {
          activeLogger.debug(logPayload, 'No active Supabase session found')
        } else {
          activeLogger.warn(logPayload, 'Supabase session validation failed')
        }
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
          supabaseUserIdHash: user?.id ? hashLogValue(user.id) : undefined,
          userEmailHash: user?.email ? hashLogValue(user.email) : undefined,
        },
        'Supabase user payload is missing required fields',
      )
      return null
    }

    // Transform to AuthData format
    return transformSupabaseUser(user)
  } catch (error: unknown) {
    if (isExpectedMissingSessionError(error)) {
      activeLogger.debug(
        {
          err: toLoggedError(error),
          event: 'auth.supabase.session.invalid',
        },
        'No active Supabase session found',
      )
      return null
    }

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
