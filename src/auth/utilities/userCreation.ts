/**
 * User creation utilities for Supabase authentication strategy.
 * Handles creating new users in PayloadCMS collections.
 */

import type { AuthData, UserConfig } from '@/auth/types/authTypes'

/**
 * Prepares user data for creation based on collection type.
 * @param authData - The authentication data from Supabase
 * @param config - The user configuration for the collection
 * @returns The prepared user data object
 */
export function prepareUserData(authData: AuthData, config: UserConfig): any {
  const userData: any = {
    supabaseUserId: authData.supabaseUserId,
    email: authData.userEmail,
  }

  // Collection-specific fields
  if (config.collection === 'basicUsers') {
    userData.userType = authData.userType
  } else if (config.collection === 'patients') {
    userData.firstName = authData.firstName || 'Unknown'
    userData.lastName = authData.lastName || 'User'
  }

  return userData
}

/**
 * Creates a new user in the specified collection.
 * Profile creation is handled by collection hooks for BasicUsers.
 * @param payload - The PayloadCMS instance
 * @param authData - The authentication data from Supabase
 * @param config - The user configuration
 * @param req - The request object
 * @returns The created user document
 */
export async function createUser(
  payload: any,
  authData: AuthData,
  config: UserConfig,
  req: any,
): Promise<any> {
  const userData = prepareUserData(authData, config)

  try {
    const userDoc = await payload.create({
      collection: config.collection,
      data: userData,
      req,
      overrideAccess: true,
    })

    console.info(`Created ${authData.userType} user: ${userDoc.id}`)
    return userDoc
  } catch (error: any) {
    console.error(`Failed to create ${authData.userType} user:`, error.message)
    throw new Error(`User creation failed: ${error.message}`)
  }
}
