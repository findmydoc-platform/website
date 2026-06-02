/**
 * User lookup utilities for Supabase authentication strategy.
 * Handles finding existing users in PayloadCMS collections.
 */

import type { AuthData } from '@/auth/types/authTypes'
import { getUserConfig as getAuthConfig } from '@/auth/config/authConfig'
import { AUTH_FLOW_ERROR_CODES, AuthFlowError, toErrorMessage } from '@/auth/errors/authFlowError'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import type { Payload, PayloadRequest } from 'payload'
import type { BasicUser, Patient } from '@/payload-types'
import { createScopedLogger, getRequestLogContext, hashLogValue, type ServerLogger } from '@/utilities/logging/shared'

/**
 * Finds an existing user by Supabase ID in the appropriate collection.
 * @param payload - The PayloadCMS instance
 * @param authData - The authentication data containing user details
 * @returns The user document if found, null otherwise
 */
export async function findUserBySupabaseId(
  payload: Payload,
  authData: AuthData,
  req?: PayloadRequest,
  logger?: ServerLogger,
): Promise<BasicUser | Patient | null> {
  const activeLogger = createScopedLogger((logger ?? payload.logger) as ServerLogger, {
    scope: 'auth.supabase',
    ...getRequestLogContext({ req, headers: req?.headers }),
  })
  const config = getAuthConfig(authData.userType)
  const { collection } = config

  try {
    const userBySupabaseId = await payload.find({
      collection,
      where: { supabaseUserId: { equals: authData.supabaseUserId } },
      limit: 1,
      overrideAccess: true,
      req,
    })

    if (userBySupabaseId.docs.length > 0) {
      return userBySupabaseId.docs[0] as BasicUser | Patient
    }

    return null
  } catch (error: unknown) {
    const message = toErrorMessage(error)
    activeLogger.error(
      {
        collection,
        err: error instanceof Error ? error : new Error(message),
        event: 'auth.supabase.user.lookup_failed',
        userType: authData.userType,
        supabaseUserId: authData.supabaseUserId,
        userEmailHash: hashLogValue(normalizeEmail(authData.userEmail)),
      },
      'Failed to find payload user during Supabase authentication',
    )
    throw new AuthFlowError({
      code: AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED,
      message: `User lookup failed: ${message}`,
      retryable: true,
      causeError: error,
    })
  }
}

/**
 * Checks if a clinic user is approved for admin access.
 * @param payload - The PayloadCMS instance
 * @param userId - The user ID to check
 * @returns true if approved, false otherwise
 */
export async function isClinicUserApproved(
  payload: Payload,
  userId: string,
  req?: PayloadRequest,
  logger?: ServerLogger,
): Promise<boolean> {
  const activeLogger = createScopedLogger((logger ?? payload.logger) as ServerLogger, {
    scope: 'auth.supabase',
    ...getRequestLogContext({ req, headers: req?.headers }),
  })

  try {
    const clinicStaffResult = await payload.find({
      collection: 'clinicStaff',
      where: {
        user: { equals: userId },
        status: { equals: 'approved' },
      },
      limit: 1,
      overrideAccess: true,
      req,
    })

    return clinicStaffResult.docs.length > 0
  } catch (error: unknown) {
    activeLogger.error(
      {
        err: error instanceof Error ? error : new Error(String(error)),
        event: 'auth.supabase.clinic_approval_check_failed',
        userId,
      },
      'Failed to check clinic staff approval',
    )
    return false
  }
}
