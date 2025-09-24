import type { CollectionBeforeChangeHook } from 'payload'
import type { Patient } from '@/payload-types'
import { createSupabaseAccount } from '@/auth/utilities/supabaseProvision'

export const patientSupabaseCreateHook: CollectionBeforeChangeHook<Patient> = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (data.supabaseUserId) {
    req.payload.logger.info(`Patient creation with existing supabaseUserId: ${data.supabaseUserId}`)
    return data
  }
  const { payload } = req
  try {
    const ctxMeta = req.context?.userMetadata as { firstName?: string; lastName?: string } | undefined
    const userMetadata = { firstName: ctxMeta?.firstName || data.firstName, lastName: ctxMeta?.lastName || data.lastName }
    payload.logger.info(`Creating Supabase user for Patient: ${data.email}, ${userMetadata.firstName} ${userMetadata.lastName}`)
    const supabaseUserId = await createSupabaseAccount({ email: data.email!, password: (data as any).password, userType: 'patient', userMetadata })
    payload.logger.info(`Successfully created Supabase user for Patient: ${data.email}`, { supabaseUserId })
    return { ...data, supabaseUserId }
  } catch (error: any) {
    req.payload.logger.error(`Failed to create Supabase user for Patient: ${data.email}`, { error: error.message })
    throw new Error(`Supabase user creation failed: ${error.message}`)
  }
}
