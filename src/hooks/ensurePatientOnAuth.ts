import type { Payload, PayloadRequest } from 'payload'
import type { AuthData } from '@/auth/types/authTypes'
import {
  AUTH_FLOW_ERROR_CODES,
  AuthFlowError,
  isConflictErrorMessage,
  toErrorMessage,
} from '@/auth/errors/authFlowError'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { createScopedLogger, getRequestLogContext, hashLogValue, type ServerLogger } from '@/utilities/logging/shared'

interface EnsurePatientArgs {
  payload: Payload
  authData: AuthData
  logger?: ServerLogger
  req: PayloadRequest | undefined
}

/**
 * Idempotently provisions a patient record when a Supabase user logs in for the first time.
 */
export async function ensurePatientOnAuth({ payload, authData, logger, req }: EnsurePatientArgs) {
  const activeLogger = createScopedLogger((logger ?? payload.logger) as ServerLogger, {
    scope: 'auth.supabase',
    ...getRequestLogContext({ req, headers: req?.headers }),
  })
  const normalizedEmail = normalizeEmail(authData.userEmail)

  if (!isValidEmail(normalizedEmail)) {
    throw new AuthFlowError({
      code: AUTH_FLOW_ERROR_CODES.INVALID_EMAIL,
      message: 'Patient provisioning failed: Invalid email provided for authenticated user',
    })
  }

  try {
    const existing = await payload.find({
      collection: 'patients',
      where: { supabaseUserId: { equals: authData.supabaseUserId } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      return existing.docs[0]
    }

    const patient = await payload.create({
      collection: 'patients',
      data: {
        supabaseUserId: authData.supabaseUserId,
        email: normalizedEmail,
        firstName: authData.firstName || normalizedEmail.split('@')[0] || 'Patient',
        lastName: authData.lastName || 'Account',
      },
      req,
      context: {
        skipSupabaseUserCreation: true,
        userMetadata: {
          firstName: authData.firstName ?? '',
          lastName: authData.lastName ?? '',
        },
      },
      overrideAccess: true,
    })

    activeLogger.info(
      {
        event: 'auth.supabase.patient.provisioned',
        supabaseUserId: authData.supabaseUserId,
        collection: 'patients',
        patientId: patient.id,
        userEmailHash: hashLogValue(normalizedEmail),
      },
      'Provisioned patient during first authenticated login',
    )

    return patient
  } catch (error: unknown) {
    if (error instanceof AuthFlowError) {
      throw error
    }

    const message = toErrorMessage(error)

    if (isConflictErrorMessage(message)) {
      const existing = await payload.find({
        collection: 'patients',
        where: { supabaseUserId: { equals: authData.supabaseUserId } },
        limit: 1,
        overrideAccess: true,
      })

      const recoveredPatient = existing.docs[0]
      if (recoveredPatient) {
        activeLogger.warn(
          {
            event: 'auth.supabase.patient.provision_conflict_recovered',
            supabaseUserId: authData.supabaseUserId,
            patientId: recoveredPatient.id,
          },
          'Recovered patient provisioning from concurrent create conflict',
        )
        return recoveredPatient
      }
    }

    activeLogger.error(
      {
        err: error instanceof Error ? error : new Error(message),
        event: 'auth.supabase.patient.provision_failed',
        supabaseUserId: authData.supabaseUserId,
        userEmailHash: hashLogValue(normalizedEmail),
      },
      'Failed to provision patient during authentication',
    )

    throw new AuthFlowError({
      code: AUTH_FLOW_ERROR_CODES.PATIENT_PROVISION_FAILED,
      message: `Patient provisioning failed: ${message}`,
      retryable: true,
      causeError: error,
    })
  }
}
