/**
 * Access validation utilities for authentication strategy.
 * Handles authorization and permission checks.
 */

import type { AuthData, UserResult } from '@/auth/types/authTypes'
import { VALID_USER_TYPES } from '@/auth/config/authConfig'
import type { Payload } from 'payload'

/**
 * Validates if a clinic user has admin access.
 * Clinic users need to be approved in the clinicStaff collection.
 * @param payload - The PayloadCMS instance
 * @param authData - The authentication data
 * @param userResult - The user lookup result
 * @returns true if access is granted, false otherwise
 */
export async function validateClinicAccess(
  payload: Payload,
  authData: AuthData,
  userResult: UserResult,
): Promise<boolean> {
  if (authData.userType !== 'clinic') {
    return true // Non-clinic users don't need this validation
  }

  const userId = userResult.user.id

  try {
    const clinicStaffResult = await payload.find({
      collection: 'clinicStaff',
      where: {
        user: { equals: userId },
        status: { equals: 'approved' },
      },
      limit: 1,
    })

    const isApproved = clinicStaffResult.docs.length > 0

    if (!isApproved) {
      console.warn(`Clinic user ${userResult.user.id} not approved for admin access`)
    }

    return isApproved
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error checking clinic staff approval:', msg)
    return false
  }
}

/**
 * Validates user permissions based on user type.
 * @param authData - The authentication data
 * @returns true if user type has valid permissions
 */
export function validateUserTypePermissions(authData: AuthData): boolean {
  if (!VALID_USER_TYPES.includes(authData.userType)) {
    return false
  }

  return true
}

/**
 * Comprehensive access validation for authenticated users.
 * @param payload - The PayloadCMS instance
 * @param authData - The authentication data
 * @param userResult - The user lookup result
 * @returns true if all access validations pass
 */
export async function validateUserAccess(
  payload: Payload,
  authData: AuthData,
  userResult: UserResult,
): Promise<boolean> {
  // Basic user type validation
  if (!validateUserTypePermissions(authData)) {
    return false
  }

  // Clinic-specific access validation
  if (!(await validateClinicAccess(payload, authData, userResult))) {
    return false
  }

  return true
}
