/**
 * User lookup utilities for Supabase authentication strategy.
 * Handles finding existing users in PayloadCMS collections.
 */

import type { AuthData } from '@/auth/types/authTypes'
import { getUserConfig as getAuthConfig } from '@/auth/config/authConfig'
import { AUTH_FLOW_ERROR_CODES, AuthFlowError, isAuthFlowError, toErrorMessage } from '@/auth/errors/authFlowError'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import type { Payload, PayloadRequest } from 'payload'
import type { ClinicStaff, Patient, PlatformStaff } from '@/payload-types'
import { createScopedLogger, getRequestLogContext, hashLogValue, type ServerLogger } from '@/utilities/logging/shared'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'

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
): Promise<ClinicStaff | Patient | PlatformStaff | null> {
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

    if (userBySupabaseId.docs.length !== 1) {
      return null
    }

    const otherCollections = (['platformStaff', 'clinicStaff', 'patients'] as const).filter(
      (candidate) => candidate !== collection,
    )
    const conflicts = await Promise.all(
      otherCollections.map((candidate) =>
        payload.find({
          collection: candidate,
          where: { supabaseUserId: { equals: authData.supabaseUserId } },
          limit: 1,
          overrideAccess: true,
          req,
        }),
      ),
    )

    if (conflicts.some((result) => result.docs.length > 0)) {
      throw new AuthFlowError({
        code: AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED,
        message: 'Supabase identity resolves to more than one Payload principal',
      })
    }

    return userBySupabaseId.docs[0] as ClinicStaff | Patient | PlatformStaff
  } catch (error: unknown) {
    const message = toErrorMessage(error)
    activeLogger.error(
      {
        collection,
        err: error instanceof Error ? error : new Error(message),
        event: 'auth.supabase.user.lookup_failed',
        userType: authData.userType,
        supabaseUserIdHash: hashLogValue(authData.supabaseUserId),
        userEmailHash: hashLogValue(normalizeEmail(authData.userEmail)),
      },
      'Failed to find payload user during Supabase authentication',
    )

    if (isAuthFlowError(error)) {
      throw error
    }

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
    return Boolean(await readClinicAccessState(payload, userId, req))
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
