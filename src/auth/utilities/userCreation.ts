/**
 * User creation utilities for Supabase authentication strategy.
 * Handles creating new users in PayloadCMS collections.
 */

import type { AuthData, UserConfig } from '@/auth/types/authTypes'
import {
  AUTH_FLOW_ERROR_CODES,
  AuthFlowError,
  isConflictErrorMessage,
  isInvalidEmailErrorMessage,
  toErrorMessage,
} from '@/auth/errors/authFlowError'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import type { Payload, PayloadRequest } from 'payload'
import type { BasicUser, Patient } from '@/payload-types'

/**
 * Prepares user data for creation based on collection type.
 * @param authData - The authentication data from Supabase
 * @param config - The user configuration for the collection
 * @returns The prepared user data object
 */
export function prepareUserData(authData: AuthData, config: UserConfig): Partial<BasicUser | Patient> {
  const normalizedEmail = normalizeEmail(authData.userEmail)

  const userData: Partial<BasicUser | Patient> = {
    supabaseUserId: authData.supabaseUserId,
    email: normalizedEmail,
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
  req: PayloadRequest | undefined,
): Promise<BasicUser | Patient> {
  const normalizedEmail = normalizeEmail(authData.userEmail)
  const logger = payload.logger ?? console

  if (!isValidEmail(normalizedEmail)) {
    throw new AuthFlowError({
      code: AUTH_FLOW_ERROR_CODES.INVALID_EMAIL,
      message: 'User creation failed: Invalid email provided for authenticated user',
    })
  }

  try {
    if (config.collection === 'basicUsers') {
      const data: Pick<BasicUser, 'supabaseUserId' | 'email' | 'userType' | 'firstName' | 'lastName'> = {
        supabaseUserId: authData.supabaseUserId,
        email: normalizedEmail,
        userType: authData.userType as BasicUser['userType'],
        firstName: authData.firstName ?? '',
        lastName: authData.lastName ?? '',
      }

      const createArgs = {
        collection: config.collection,
        data,
        req,
        context: {
          skipSupabaseUserCreation: true,
          userMetadata: {
            firstName: authData.firstName ?? '',
            lastName: authData.lastName ?? '',
          },
        },
        overrideAccess: true,
        ...(config.requiresApproval ? { draft: false } : {}),
      }

      const userDoc = (await payload.create(createArgs)) as BasicUser

      logger.info(
        {
          userId: userDoc.id,
          userType: authData.userType,
          supabaseUserId: authData.supabaseUserId,
        },
        'Created payload user from authenticated Supabase session',
      )
      return userDoc
    }

    const data: Pick<Patient, 'supabaseUserId' | 'email' | 'firstName' | 'lastName'> = {
      supabaseUserId: authData.supabaseUserId,
      email: normalizedEmail,
      firstName: authData.firstName ?? '',
      lastName: authData.lastName ?? '',
    }

    const patientCreateArgs = {
      collection: config.collection,
      data,
      req,
      context: {
        skipSupabaseUserCreation: true,
        userMetadata: {
          firstName: authData.firstName ?? '',
          lastName: authData.lastName ?? '',
        },
      },
      overrideAccess: true,
      ...(config.requiresApproval ? { draft: false } : {}),
    }

    const userDoc = (await payload.create(patientCreateArgs)) as Patient

    logger.info(
      {
        userId: userDoc.id,
        userType: authData.userType,
        supabaseUserId: authData.supabaseUserId,
      },
      'Created payload user from authenticated Supabase session',
    )
    return userDoc
  } catch (error: unknown) {
    if (error instanceof AuthFlowError) {
      throw error
    }

    const message = toErrorMessage(error)

    logger.error(
      {
        userType: authData.userType,
        supabaseUserId: authData.supabaseUserId,
        error: message,
      },
      'Failed to create payload user from authenticated Supabase session',
    )

    if (isInvalidEmailErrorMessage(message)) {
      throw new AuthFlowError({
        code: AUTH_FLOW_ERROR_CODES.INVALID_EMAIL,
        message: `User creation failed: ${message}`,
        causeError: error,
      })
    }

    if (isConflictErrorMessage(message)) {
      throw new AuthFlowError({
        code: AUTH_FLOW_ERROR_CODES.USER_CREATE_CONFLICT,
        message: `User creation failed: ${message}`,
        retryable: true,
        causeError: error,
      })
    }

    throw new AuthFlowError({
      code: AUTH_FLOW_ERROR_CODES.USER_CREATE_FAILED,
      message: `User creation failed: ${message}`,
      retryable: true,
      causeError: error,
    })
  }
}
