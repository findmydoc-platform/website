import type { AuthData, UserResult } from '@/auth/types/authTypes'
import { getUserConfig } from '@/auth/config/authConfig'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import { createUser } from '@/auth/utilities/userCreation'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { validateUserAccess } from '@/auth/utilities/accessValidation'
import { getPostHogServer } from '@/lib/posthog-server'

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
    try {
      const posthog = getPostHogServer()
      posthog.identify({
        distinctId: authData.supabaseUserId,
        properties: {
          email: authData.userEmail,
          user_type: authData.userType,
          first_name: authData.firstName,
          last_name: authData.lastName,
        },
      })
    } catch (error) {
      console.warn('Failed to identify user in PostHog:', error)
      // Don't fail authentication if PostHog identification fails
    }

    console.info('Authentication successful', {
      userId: result.user.id,
      userType: authData.userType,
    })

    return {
      user: {
        collection: result.collection,
        ...result.user,
      },
    }
  } catch (err: any) {
    console.error('Supabase auth strategy error:', err.message)
    return { user: null }
  }
}

export const supabaseStrategy = {
  name: 'supabase',
  authenticate,
}
