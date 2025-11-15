import type { CollectionBeforeChangeHook } from 'payload'
import type { Patient } from '@/payload-types'
import { inviteSupabaseAccount } from '@/auth/utilities/supabaseProvision'

export const patientSupabaseCreateHook: CollectionBeforeChangeHook<Patient> = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (data.supabaseUserId) {
    req.payload.logger.info(`Patient creation with existing supabaseUserId: ${data.supabaseUserId}`)
    return data
  }
  const { payload } = req
  try {
    const ctxMeta = req.context?.userMetadata as { firstName?: string; lastName?: string } | undefined
    const userMetadata = {
      firstName: ctxMeta?.firstName || data.firstName,
      lastName: ctxMeta?.lastName || data.lastName,
    }
    payload.logger.info(
      `Creating Supabase user for Patient: ${data.email}, ${userMetadata.firstName} ${userMetadata.lastName}`,
    )
    const supabaseUserId = await inviteSupabaseAccount({
      email: data.email!,
      userType: 'patient',
      userMetadata,
    })
    payload.logger.info({ supabaseUserId }, `Successfully created Supabase user for Patient: ${data.email}`)
    return {
      ...data,
      supabaseUserId,
    }
  } catch (error: any) {
    req.payload.logger.error(error, `Failed to create Supabase user for Patient: ${data.email}`)
    throw new Error(`Supabase user creation failed: ${error.message}`)
  }
}
