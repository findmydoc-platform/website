/**
 * User creation utilities for Supabase authentication strategy.
 * Handles creating new users in PayloadCMS collections.
 */

import type { AuthData, UserConfig } from '@/auth/types/authTypes'
import type { Payload, PayloadRequest } from 'payload'
import type { BasicUser, Patient } from '@/payload-types'

/**
 * Prepares user data for creation based on collection type.
 * @param authData - The authentication data from Supabase
 * @param config - The user configuration for the collection
 * @returns The prepared user data object
 */
export function prepareUserData(authData: AuthData, config: UserConfig): Partial<BasicUser | Patient> {
  const userData: Partial<BasicUser | Patient> = {
    supabaseUserId: authData.supabaseUserId,
    email: authData.userEmail,
  }

  // Collection-specific fields
  if (config.collection === 'basicUsers') {
    ;(userData as Partial<BasicUser>).userType = authData.userType as BasicUser['userType']
    ;(userData as Partial<BasicUser>).firstName = authData.firstName || ''
    ;(userData as Partial<BasicUser>).lastName = authData.lastName || ''
  } else if (config.collection === 'patients') {
    ;(userData as Partial<Patient>).firstName = authData.firstName || ''
    ;(userData as Partial<Patient>).lastName = authData.lastName || ''
  }

  return userData
}

/**
 * Creates a new user document; profile creation (for staff) is handled by collection hooks.
 * Throws if persistence fails; callers should surface a generic auth error.
 */
export async function createUser(
  payload: Payload,
  authData: AuthData,
  config: UserConfig,
  req: PayloadRequest,
): Promise<BasicUser | Patient> {
  try {
    if (config.collection === 'basicUsers') {
      const data: Pick<BasicUser, 'supabaseUserId' | 'email' | 'userType' | 'firstName' | 'lastName'> = {
        supabaseUserId: authData.supabaseUserId,
        email: authData.userEmail,
        userType: authData.userType as BasicUser['userType'],
        firstName: authData.firstName ?? '',
        lastName: authData.lastName ?? '',
      }

      const createArgs = {
        collection: config.collection,
        data,
        req,
        overrideAccess: true,
        ...(config.requiresApproval ? { draft: false } : {}),
      }

      const userDoc = (await payload.create(createArgs)) as BasicUser

      console.info(`Created ${authData.userType} user: ${userDoc.id}`)
      return userDoc
    }

    const data: Pick<Patient, 'supabaseUserId' | 'email' | 'firstName' | 'lastName'> = {
      supabaseUserId: authData.supabaseUserId,
      email: authData.userEmail,
      firstName: authData.firstName ?? '',
      lastName: authData.lastName ?? '',
    }

    const patientCreateArgs = {
      collection: config.collection,
      data,
      req,
      overrideAccess: true,
      ...(config.requiresApproval ? { draft: false } : {}),
    }

    const userDoc = (await payload.create(patientCreateArgs)) as Patient

    console.info(`Created ${authData.userType} user: ${userDoc.id}`)
    return userDoc
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Failed to create ${authData.userType} user:`, msg)
    throw new Error(`User creation failed: ${msg}`)
  }
}
