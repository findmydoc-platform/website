import type { CollectionBeforeDeleteHook } from 'payload'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'

/**
 * beforeDelete: remove profile(s) first (avoids FK issues) then best‑effort delete Supabase user.
 * Never throws; logs failures so Payload deletion proceeds.
 */
export const deleteSupabaseUserHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req

  try {
    const userDoc = await payload.findByID({
      collection: 'basicUsers',
      id,
      req,
      overrideAccess: true,
    })

    if (!userDoc) {
      payload.logger.warn(`BasicUser ${id} not found during deletion`)
      return
    }

    if (userDoc.userType) {
      payload.logger.info(`Cleaning up profile records for BasicUser: ${id}`, {
        userType: userDoc.userType,
        userEmail: userDoc.email,
      })

      const profileCollection = userDoc.userType === 'clinic' ? 'clinicStaff' : 'platformStaff'

      const profileQuery = await payload.find({
        collection: profileCollection,
        where: {
          user: { equals: id },
        },
        limit: 10,
        req,
        overrideAccess: true,
      })

      if (profileQuery.docs.length > 0) {
        for (const profile of profileQuery.docs) {
          try {
            await payload.delete({
              collection: profileCollection,
              id: profile.id,
              req,
              overrideAccess: true,
            })

            payload.logger.info(`Deleted profile record: ${profile.id} from ${profileCollection}`, {
              basicUserId: id,
            })
          } catch (profileError: any) {
            payload.logger.error(`Failed to delete profile record: ${profile.id}`, {
              error: profileError.message,
              profileCollection,
              basicUserId: id,
            })
          }
        }

        payload.logger.info(`Completed profile cleanup for BasicUser: ${id}`, {
          profilesDeleted: profileQuery.docs.length,
          profileCollection,
        })
      } else {
        payload.logger.info(`No profile records found for BasicUser: ${id} in collection: ${profileCollection}`)
      }
    }

    if (userDoc.supabaseUserId) {
      payload.logger.info(`Deleting Supabase user for BasicUser: ${id}`, {
        supabaseUserId: userDoc.supabaseUserId,
        userEmail: userDoc.email,
      })

      const supabase = await createAdminClient()
      const { error } = await supabase.auth.admin.deleteUser(userDoc.supabaseUserId)

      if (error) {
        payload.logger.error(`Failed to delete Supabase user: ${userDoc.supabaseUserId}`, {
          error: error.message,
          basicUserId: id,
        })
      } else {
        payload.logger.info(`Successfully deleted Supabase user: ${userDoc.supabaseUserId}`, {
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
