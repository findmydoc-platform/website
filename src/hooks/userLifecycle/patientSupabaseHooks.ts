import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook } from 'payload'
import type { Patient } from '@/payload-types'
import { createSupabaseAccount, deleteSupabaseAccount } from '@/auth/utilities/supabaseProvision'

// Create Supabase user on Patient create
/**
 * Patient Supabase provisioning hook.
 * Accepts password precedence:
 * 1. req.context.password (explicitly passed by secure server route / first-admin flow)
 * 2. data.password (transient field from public/admin forms). Not stored.
 *
 * Only used on create. Ensures any transient password fields are stripped before persistence.
 */
export const patientSupabaseCreateHook: CollectionBeforeChangeHook<Patient> = async ({ data, operation, req }) => {
  if (operation !== 'create') return data

  if (data.supabaseUserId) {
    req.payload.logger.info(`Patient creation with existing supabaseUserId: ${data.supabaseUserId}`)
    return data
  }

  const { payload } = req
  try {
    const userMetadata = req.context?.userMetadata as { firstName?: string; lastName?: string } | undefined

    const metadata = userMetadata || {}
    metadata.firstName = data.firstName
    metadata.lastName = data.lastName

    payload.logger.info(
      `Creating Supabase user for Patient: ${data.email}, ${metadata?.firstName} ${metadata?.lastName}`,
    )

    const supabaseUserId = await createSupabaseAccount({
      email: data.email!,
      password: data.password,
      userType: 'patient',
      userMetadata: metadata,
    })

    payload.logger.info(`Successfully created Supabase user for Patient: ${data.email}`, {
      supabaseUserId,
    })

    return {
      ...data,
      supabaseUserId,
    }
  } catch (error: any) {
    payload.logger.error(`Failed to create Supabase user for Patient: ${data.email}`, {
      error: error.message,
      stack: error.stack,
    })
    throw new Error(`Supabase user creation failed: ${error.message}`)
  }
}

// Delete Supabase user on Patient delete
export const patientSupabaseDeleteHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req
  try {
    const doc = await payload.findByID({ collection: 'patients', id, req, overrideAccess: true })
    if (!doc) return
    if (!doc.supabaseUserId) {
      payload.logger.warn(`No supabaseUserId found for Patient ${id} during deletion`)
      return
    }

    payload.logger.info(`Deleting Supabase user for Patient: ${id}`, { supabaseUserId: doc.supabaseUserId })
    const ok = await deleteSupabaseAccount(doc.supabaseUserId)
    if (!ok) {
      payload.logger.error(`Failed to delete Supabase user for Patient: ${id}`, { supabaseUserId: doc.supabaseUserId })
    } else {
      payload.logger.info(`Successfully deleted Supabase user for Patient: ${id}`)
    }
  } catch (error: any) {
    payload.logger.error(`Error during Supabase user deletion for Patient: ${id}`, {
      error: error.message,
      stack: error.stack,
    })
  }
}
