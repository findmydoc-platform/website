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
async function createOrFindUser(payload: any, authData: AuthData, req: any): Promise<UserResult> {
  const config = getUserConfig(authData.userType)
  const { collection } = config

  if (authData.userType === 'patient') {
    const patient = await ensurePatientOnAuth({ payload, authData, req })
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

const authenticate = async (args: any) => {
  const { payload, req } = args
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

    return {
      user: {
        collection: result.collection,
        ...result.user,
      },
    }
  } catch (err: any) {
    logger.error(
      {
        error: err?.message,
        stack: err?.stack,
      },
      'Supabase auth strategy error',
    )
    return { user: null }
  }
}

export const supabaseStrategy = {
  name: 'supabase',
  authenticate,
}
