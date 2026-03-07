import type { Payload, PayloadRequest } from 'payload'
import type { AuthData } from '@/auth/types/authTypes'
import {
  AUTH_FLOW_ERROR_CODES,
  AuthFlowError,
  isConflictErrorMessage,
  toErrorMessage,
} from '@/auth/errors/authFlowError'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'

interface EnsurePatientArgs {
  payload: Payload
  authData: AuthData
  req: PayloadRequest | undefined
}

/**
 * Idempotently provisions a patient record when a Supabase user logs in for the first time.
 */
export async function ensurePatientOnAuth({ payload, authData, req }: EnsurePatientArgs) {
  const logger = payload.logger ?? console
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

    logger.info(
      {
        supabaseUserId: authData.supabaseUserId,
        collection: 'patients',
        patientId: patient.id,
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
        logger.info(
          {
            supabaseUserId: authData.supabaseUserId,
            patientId: recoveredPatient.id,
          },
          'Recovered patient provisioning from concurrent create conflict',
        )
        return recoveredPatient
      }
    }

    logger.error(
      {
        supabaseUserId: authData.supabaseUserId,
        error: message,
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
