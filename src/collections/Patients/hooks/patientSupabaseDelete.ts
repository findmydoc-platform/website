import type { CollectionBeforeDeleteHook } from 'payload'
import { deleteSupabaseAccount } from '@/auth/utilities/supabaseProvision'

export const patientSupabaseDeleteHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req

  try {
    const doc = await payload.findByID({ collection: 'patients', id, req, overrideAccess: true })
    if (!doc) return

    if (!doc.supabaseUserId) {
      payload.logger.warn(`No supabaseUserId found for Patient ${id} during deletion`)
      return
    }

    payload.logger.info({ supabaseUserId: doc.supabaseUserId }, `Deleting Supabase user for Patient: ${id}`)
    const ok = await deleteSupabaseAccount(doc.supabaseUserId)

    if (!ok) {
      throw new Error(`Failed to delete the external account for Patient ${id}`)
    }
  } catch (error: unknown) {
    payload.logger.error(error, `Error during Supabase user deletion for Patient: ${id}`)
    throw new Error(`Failed to delete the external account for Patient ${id}`)
  }
}
