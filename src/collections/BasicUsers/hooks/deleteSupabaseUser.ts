import type { CollectionBeforeDeleteHook } from 'payload'
import { deleteSupabaseAccount } from '@/auth/utilities/supabaseProvision'

/**
 * beforeDelete: remove profile(s) first (avoids FK issues) then best‑effort delete Supabase user.
 * Never throws; logs failures so Payload deletion proceeds.
 */
export const deleteSupabaseUserHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req

  try {
    const userDoc = await payload.findByID({ collection: 'basicUsers', id, req, overrideAccess: true })

    if (!userDoc) {
      payload.logger.warn(`BasicUser ${id} not found during deletion`)
      return
    }

    if (userDoc.userType) {
      const profileCollection = userDoc.userType === 'clinic' ? 'clinicStaff' : 'platformStaff'

      const profileQuery = await payload.find({
        collection: profileCollection,
        where: { user: { equals: id } },
        limit: 10,
        req,
        overrideAccess: true,
      })

      if (profileQuery.docs.length > 0) {
        for (const profile of profileQuery.docs) {
          try {
            await payload.delete({ collection: profileCollection, id: profile.id, req, overrideAccess: true })
          } catch (profileError: any) {
            payload.logger.error(`Failed to delete profile record: ${profile.id}`, {
              error: profileError.message,
              profileCollection,
              basicUserId: id,
            })
          }
        }
      }
    }

    if (userDoc.supabaseUserId) {
      try {
        const ok = await deleteSupabaseAccount(userDoc.supabaseUserId)
        if (!ok) {
          payload.logger.error(`Failed to delete Supabase user: ${userDoc.supabaseUserId}`, { basicUserId: id })
        }
      } catch (e: any) {
        payload.logger.error(`Failed to delete Supabase user: ${userDoc.supabaseUserId}`, {
          error: e?.message,
          basicUserId: id,
        })
      }
    } else {
      payload.logger.warn(`No supabaseUserId found for BasicUser ${id} during deletion`)
    }
  } catch (error: any) {
    payload.logger.error(`Error during user and profile deletion for BasicUser: ${id}`, {
      error: error.message,
      stack: error.stack,
    })
  }
}
