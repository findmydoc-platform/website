import type { AuthData, UserResult } from '@/auth/types/authTypes'
import { getUserConfig } from '@/auth/utilities/userLookup'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import { createUser } from '@/auth/utilities/userCreation'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { validateUserAccess } from '@/auth/utilities/accessValidation'

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

  console.info(`Looking up user in ${collection}`, {
    supabaseUserId: authData.supabaseUserId,
    userType: authData.userType,
  })

  // Try to find existing user
  const existingUser = await findUserBySupabaseId(payload, authData)

  if (existingUser) {
    console.info(`Found existing user: ${existingUser.id}`)
    return { user: existingUser, collection }
  }

  // Create new user if not found
  console.info(`Creating new ${authData.userType} user`)
  const userDoc = await createUser(payload, authData, config, req)
  
  return { user: userDoc, collection }
}

const authenticate = async (args: any) => {
  const { payload, req } = args
  try {
    console.info('Starting Supabase authentication')

    // Extract user data from Supabase (supports both headers and cookies)
    const authData = await extractSupabaseUserData(req)
    if (!authData) {
      console.warn('No auth data found - user not logged in')
      return { user: null }
    }

    console.info('Auth data extracted', {
      supabaseUserId: authData.supabaseUserId,
      userType: authData.userType,
    })

    // Create or find user in appropriate collection
    const result = await createOrFindUser(payload, authData, req)

    // Validate user access (includes clinic approval check)
    const hasAccess = await validateUserAccess(payload, authData, result)
    if (!hasAccess) {
      return { user: null }
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
