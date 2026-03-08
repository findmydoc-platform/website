import type { CollectionBeforeChangeHook } from 'payload'
import type { Patient } from '@/payload-types'
import { inviteSupabaseAccount } from '@/auth/utilities/supabaseProvision'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { hashLogValue } from '@/utilities/logging/shared'

export const patientSupabaseCreateHook: CollectionBeforeChangeHook<Patient> = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (req.context?.skipSupabaseUserCreation) return data
  if (data.supabaseUserId) {
    req.payload.logger.info(
      {
        event: 'auth.supabase.hook.patient_existing_supabase_id',
        supabaseUserId: data.supabaseUserId,
      },
      'Patient creation received an existing Supabase user id',
    )
    return data
  }
  const normalizedEmail = normalizeEmail(data.email)
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Supabase user creation failed: Invalid email format')
  }
  const { payload } = req
  try {
    const ctxMeta = req.context?.userMetadata as { firstName?: string; lastName?: string } | undefined
    const userMetadata = {
      firstName: ctxMeta?.firstName || data.firstName,
      lastName: ctxMeta?.lastName || data.lastName,
    }
    payload.logger.info(
      {
        event: 'auth.supabase.hook.patient_create_started',
        userEmailHash: hashLogValue(normalizedEmail),
      },
      'Creating Supabase user for Patient',
    )
    const supabaseUserId = await inviteSupabaseAccount(
      {
        email: normalizedEmail,
        userType: 'patient',
        userMetadata,
      },
      req.payload.logger,
    )
    payload.logger.info(
      {
        event: 'auth.supabase.hook.patient_created',
        supabaseUserId,
        userEmailHash: hashLogValue(normalizedEmail),
      },
      'Successfully created Supabase user for Patient',
    )
    return {
      ...data,
      email: normalizedEmail,
      supabaseUserId,
    }
  } catch (error: unknown) {
    req.payload.logger.error(
      {
        err: error instanceof Error ? error : new Error(String(error)),
        event: 'auth.supabase.hook.patient_create_failed',
        userEmailHash: hashLogValue(normalizedEmail),
      },
      'Failed to create Supabase user for Patient',
    )
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Supabase user creation failed: ${msg}`)
  }
}
