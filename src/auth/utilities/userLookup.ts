/**
 * User lookup utilities for Supabase authentication strategy.
 * Handles finding existing users in PayloadCMS collections.
 */

import type { AuthData } from '@/auth/types/authTypes'
import { getUserConfig as getAuthConfig } from '@/auth/config/authConfig'
import type { Payload } from 'payload'
import type { BasicUser, Patient } from '@/payload-types'

/**
 * Finds an existing user by Supabase ID in the appropriate collection.
 * @param payload - The PayloadCMS instance
 * @param authData - The authentication data containing user details
 * @returns The user document if found, null otherwise
 */
export async function findUserBySupabaseId(payload: Payload, authData: AuthData): Promise<BasicUser | Patient | null> {
  const config = getAuthConfig(authData.userType)
  const { collection } = config

  try {
    const userQuery = await payload.find({
      collection,
      where: { supabaseUserId: { equals: authData.supabaseUserId } },
      limit: 1,
    })

    if (userQuery.docs.length > 0) {
      return userQuery.docs[0] as BasicUser | Patient
    }

    return null
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Failed to find user in ${collection}:`, msg)
    throw new Error(`User lookup failed: ${msg}`)
  }
}

/**
 * Checks if a clinic user is approved for admin access.
 * @param payload - The PayloadCMS instance
 * @param userId - The user ID to check
 * @returns true if approved, false otherwise
 */
export async function isClinicUserApproved(payload: Payload, userId: string): Promise<boolean> {
  try {
    const clinicStaffResult = await payload.find({
      collection: 'clinicStaff',
      where: {
        user: { equals: userId },
        status: { equals: 'approved' },
      },
      limit: 1,
    })

    return clinicStaffResult.docs.length > 0
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Failed to check clinic staff approval:', msg)
    return false
  }
}
