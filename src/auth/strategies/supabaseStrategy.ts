import type { AuthStrategy, AuthStrategyResult, Payload, PayloadRequest } from 'payload'

import type { AuthData, UserResult } from '@/auth/types/authTypes'
import { getUserConfig } from '@/auth/config/authConfig'
import {
  AUTH_FLOW_ERROR_CODES,
  AuthFlowError,
  isAuthFlowError,
  isConflictErrorMessage,
  isInvalidEmailErrorMessage,
  toErrorMessage,
} from '@/auth/errors/authFlowError'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import { createUser } from '@/auth/utilities/userCreation'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { validateUserAccess } from '@/auth/utilities/accessValidation'
import { identifyUser } from '@/posthog'
import { ensurePatientOnAuth } from '@/hooks/ensurePatientOnAuth'
import { createScopedLogger, getRequestLogContext, hashLogValue, type ServerLogger } from '@/utilities/logging/shared'

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
async function createOrFindUser(
  payload: Payload,
  authData: AuthData,
  req: PayloadRequest | undefined,
  logger: ServerLogger,
): Promise<UserResult> {
  const config = getUserConfig(authData.userType)
  const { collection } = config

  if (authData.userType === 'patient') {
    const patient = await ensurePatientOnAuth({ payload, authData, logger, req })
    if (!patient) {
      throw new AuthFlowError({
        code: AUTH_FLOW_ERROR_CODES.PATIENT_PROVISION_FAILED,
        message: 'Failed to ensure patient record during authentication',
        retryable: true,
      })
    }
    return { user: patient, collection }
  }

  // Try to find existing user
  const existingUser = await findUserBySupabaseId(payload, authData, req, logger)

  if (existingUser) {
    return { user: existingUser, collection }
  }

  try {
    // Create new user if not found
    const userDoc = await createUser(payload, authData, config, req, logger)
    return { user: userDoc, collection }
  } catch (error: unknown) {
    const authError = toAuthFlowError(error, AUTH_FLOW_ERROR_CODES.USER_CREATE_FAILED)

    if (authError.code === AUTH_FLOW_ERROR_CODES.USER_CREATE_CONFLICT || authError.retryable) {
      const recoveredUser = await findUserBySupabaseId(payload, authData, req, logger)
      if (recoveredUser) {
        logger.warn(
          {
            event: 'auth.supabase.user.conflict_recovered',
            supabaseUserId: authData.supabaseUserId,
            userType: authData.userType,
            recoveredUserId: recoveredUser.id,
          },
          'Recovered user provisioning from concurrent conflict',
        )
        return { user: recoveredUser, collection }
      }
    }

    throw authError
  }
}

const toAuthFlowError = (
  error: unknown,
  defaultCode: (typeof AUTH_FLOW_ERROR_CODES)[keyof typeof AUTH_FLOW_ERROR_CODES],
): AuthFlowError => {
  if (isAuthFlowError(error)) {
    return error
  }

  const message = toErrorMessage(error)

  if (isInvalidEmailErrorMessage(message)) {
    return new AuthFlowError({
      code: AUTH_FLOW_ERROR_CODES.INVALID_EMAIL,
      message,
      causeError: error,
    })
  }

  if (isConflictErrorMessage(message)) {
    return new AuthFlowError({
      code: AUTH_FLOW_ERROR_CODES.USER_CREATE_CONFLICT,
      message,
      retryable: true,
      causeError: error,
    })
  }

  return new AuthFlowError({
    code: defaultCode,
    message,
    retryable: true,
    causeError: error,
  })
}

const toAuthUser = (result: UserResult): AuthStrategyResult['user'] => {
  const base = { ...result.user, collection: result.collection }
  return base as AuthStrategyResult['user']
}

const authenticate: AuthStrategy['authenticate'] = async (args) => {
  const { payload } = args
  const req = (args as typeof args & { req?: PayloadRequest }).req
  const logger = createScopedLogger(payload.logger as ServerLogger, {
    scope: 'auth.supabase',
    ...getRequestLogContext({ headers: args.headers, req }),
  })
  try {
    logger.debug(
      {
        event: 'auth.supabase.authenticate.start',
      },
      'Supabase auth strategy started',
    )

    // Extract user data from Supabase (supports both headers and cookies)
    const authData = await extractSupabaseUserData({ headers: args.headers, logger })
    if (!authData) {
      logger.debug(
        {
          event: 'auth.supabase.authenticate.no_auth',
        },
        'No auth data found in request',
      )
      return { user: null }
    }

    logger.info(
      {
        event: 'auth.supabase.authenticate.auth_data',
        supabaseUserId: authData.supabaseUserId,
        userEmailHash: hashLogValue(normalizeEmail(authData.userEmail)),
        userType: authData.userType,
      },
      'Auth data extracted',
    )

    // Create or find user in appropriate collection
    const result = await createOrFindUser(payload, authData, req, logger)

    logger.info(
      {
        collection: result.collection,
        event: 'auth.supabase.user.ready',
        userId: result.user.id,
      },
      'User found or created',
    )

    // Validate user access (includes clinic approval check)
    const hasAccess = await validateUserAccess(payload, authData, result, logger)
    if (!hasAccess) {
      logger.warn(
        {
          event: 'auth.supabase.access.denied',
          userId: result.user.id,
        },
        'User access validation failed',
      )
      return { user: null }
    }

    // Identify user in PostHog for session tracking
    await identifyUser(authData)

    logger.info(
      {
        event: 'auth.supabase.authenticate.succeeded',
        userId: result.user.id,
        userType: authData.userType,
      },
      'Authentication successful',
    )

    const user = toAuthUser(result)

    return { user }
  } catch (error: unknown) {
    const authError = toAuthFlowError(error, AUTH_FLOW_ERROR_CODES.USER_CREATE_FAILED)
    logger.error(
      {
        code: authError.code,
        err: authError,
        event: 'auth.supabase.authenticate.failed',
        retryable: authError.retryable,
      },
      'Supabase auth strategy error',
    )
    return { user: null }
  }
}

export const supabaseStrategy: AuthStrategy = {
  name: 'supabase',
  authenticate,
}
