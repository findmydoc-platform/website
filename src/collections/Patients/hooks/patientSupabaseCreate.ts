import type { CollectionBeforeChangeHook } from 'payload'
import type { Patient } from '@/payload-types'
import { inviteSupabaseAccount } from '@/auth/utilities/supabaseProvision'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'

export const patientSupabaseCreateHook: CollectionBeforeChangeHook<Patient> = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (req.context?.skipSupabaseUserCreation) return data
  if (data.supabaseUserId) {
    req.payload.logger.info(`Patient creation with existing supabaseUserId: ${data.supabaseUserId}`)
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
      `Creating Supabase user for Patient: ${normalizedEmail}, ${userMetadata.firstName} ${userMetadata.lastName}`,
    )
    const supabaseUserId = await inviteSupabaseAccount({
      email: normalizedEmail,
      userType: 'patient',
      userMetadata,
    })
    payload.logger.info({ supabaseUserId }, `Successfully created Supabase user for Patient: ${normalizedEmail}`)
    return {
      ...data,
      email: normalizedEmail,
      supabaseUserId,
    }
  } catch (error: unknown) {
    req.payload.logger.error(error, `Failed to create Supabase user for Patient: ${normalizedEmail}`)
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Supabase user creation failed: ${msg}`)
  }
}
