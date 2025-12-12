import type { AuthStrategy, AuthStrategyResult, Payload, PayloadRequest } from 'payload'

import type { AuthData, UserResult } from '@/auth/types/authTypes'
import { getUserConfig } from '@/auth/config/authConfig'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import { createUser } from '@/auth/utilities/userCreation'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { validateUserAccess } from '@/auth/utilities/accessValidation'
import { identifyUser } from '@/posthog'
import { ensurePatientOnAuth } from '@/hooks/ensurePatientOnAuth'

/**
 * Unified Supabase authentication strategy for both BasicUsers and Patients
 * - BasicUsers (clinic/platform staff): Can access admin UI and APIs
 * - Patients: Can only access APIs for their own data
 * - Admin UI access is controlled by payload.config.ts admin.user setting
 * - API access is controlled by collection-level access rules
 * - User type validation is handled by the login API endpoints
 */

/**
 * Create or find a user in the appropriate collection based on authentication data.
 * @param payload - The PayloadCMS instance.
 * @param authData - The extracted authentication data from Supabase.
 * @param req - The request object.
 * @returns The created or found user document.
 */
async function createOrFindUser(
  payload: Payload,
  authData: AuthData,
  req: PayloadRequest | undefined,
): Promise<UserResult> {
  const config = getUserConfig(authData.userType)
  const { collection } = config

  if (authData.userType === 'patient') {
    const patient = await ensurePatientOnAuth({ payload, authData, req })
    if (!patient) {
      throw new Error('Failed to ensure patient record during authentication')
    }
    return { user: patient, collection }
  }

  // Try to find existing user
  const existingUser = await findUserBySupabaseId(payload, authData)

  if (existingUser) {
    return { user: existingUser, collection }
  }

  // Create new user if not found
  const userDoc = await createUser(payload, authData, config, req)

  return { user: userDoc, collection }
}

const toAuthUser = (result: UserResult): AuthStrategyResult['user'] => {
  const base = { ...result.user, collection: result.collection }
  return base as AuthStrategyResult['user']
}

const authenticate: AuthStrategy['authenticate'] = async (args) => {
  const { payload } = args
  const req = (args as typeof args & { req?: PayloadRequest }).req
  const logger = payload.logger ?? console
  try {
    // Extract user data from Supabase (supports both headers and cookies)
    const authData = await extractSupabaseUserData(req)
    if (!authData) {
      return { user: null }
    }

    // Create or find user in appropriate collection
    const result = await createOrFindUser(payload, authData, req)

    // Validate user access (includes clinic approval check)
    const hasAccess = await validateUserAccess(payload, authData, result)
    if (!hasAccess) {
      return { user: null }
    }

    // Identify user in PostHog for session tracking
    await identifyUser(authData)

    logger.info(
      {
        userId: result.user.id,
        userType: authData.userType,
      },
      'Authentication successful',
    )

    const user = toAuthUser(result)

    return { user }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    logger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      'Supabase auth strategy error',
    )
    return { user: null }
  }
}

export const supabaseStrategy: AuthStrategy = {
  name: 'supabase',
  authenticate,
}
