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
    payload.logger.info(`Deleting Supabase user for Patient: ${id}`, { supabaseUserId: doc.supabaseUserId })
    const ok = await deleteSupabaseAccount(doc.supabaseUserId)
    if (!ok) payload.logger.error(`Failed to delete Supabase user for Patient: ${id}`, { supabaseUserId: doc.supabaseUserId })
  } catch (error: any) {
    payload.logger.error(`Error during Supabase user deletion for Patient: ${id}`, { error: error.message })
  }
}
