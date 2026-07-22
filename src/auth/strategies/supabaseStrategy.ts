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
import { isFindmydocPlatformEmail } from '@/auth/utilities/platformStaffEmailPolicy'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { validateUserAccess } from '@/auth/utilities/accessValidation'
import { identifyPostHogActor, resolvePostHogActor } from '@/posthog/api'
import { ensurePatientOnAuth } from '@/hooks/ensurePatientOnAuth'
import { createScopedLogger, getRequestLogContext, hashLogValue, type ServerLogger } from '@/utilities/logging/shared'

/**
 * Unified Supabase authentication strategy for direct staff principals and patients.
 * - PlatformStaff can access Payload Admin and authorized APIs.
 * - ClinicStaff can access authorized APIs but not Payload Admin.
 * - Patients can only access their own authorized APIs.
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

  // Staff principals are provisioned only through trusted operations. Never auto-create them at login.
  const existingUser = await findUserBySupabaseId(payload, authData, req, logger)

  if (existingUser) {
    return { user: existingUser, collection }
  }

  logger.warn(
    {
      event: 'auth.supabase.staff_principal.not_provisioned',
      supabaseUserIdHash: hashLogValue(authData.supabaseUserId),
      userEmailHash: hashLogValue(normalizeEmail(authData.userEmail)),
      userType: authData.userType,
    },
    'Staff Supabase user is not provisioned in Payload',
  )
  throw new AuthFlowError({
    code: AUTH_FLOW_ERROR_CODES.PLATFORM_USER_NOT_PROVISIONED,
    message: 'Staff user is not provisioned in Payload',
  })
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

const isDisallowedPlatformEmail = (authData: AuthData): boolean => {
  return authData.userType === 'platform' && !isFindmydocPlatformEmail(authData.userEmail)
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

    if (isDisallowedPlatformEmail(authData)) {
      logger.warn(
        {
          event: 'auth.supabase.platform_user.invalid_email_domain',
          supabaseUserIdHash: hashLogValue(authData.supabaseUserId),
          userEmailHash: hashLogValue(normalizeEmail(authData.userEmail)),
        },
        'Platform Supabase user email is outside the allowed domain',
      )
      return { user: null }
    }

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
    const postHogActor = await resolvePostHogActor({ authData })
    await identifyPostHogActor(postHogActor)

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
