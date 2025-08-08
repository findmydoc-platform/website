import type { CollectionBeforeDeleteHook } from 'payload'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'

/**
 * Hook that removes the related Supabase user AND related profiles before a BasicUser is deleted.
 * This ensures orphaned Supabase accounts and profile records are not left behind.
 * We do both operations in beforeDelete to avoid foreign key constraint issues.
 */
export const deleteSupabaseUserHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req

  try {
    // Get the BasicUser record to find the supabaseUserId and userType
    const userDoc = await payload.findByID({
      collection: 'basicUsers',
      id,
      req,
      overrideAccess: true, // Bypass access controls for hook operations
    })

    if (!userDoc) {
      payload.logger.warn(`BasicUser ${id} not found during deletion`)
      return
    }

    // Delete related profile records FIRST to avoid foreign key constraint issues
    if (userDoc.userType) {
      payload.logger.info(`Cleaning up profile records for BasicUser: ${id}`, {
        userType: userDoc.userType,
        userEmail: userDoc.email,
      })

      // Determine the profile collection based on user type
      const profileCollection = userDoc.userType === 'clinic' ? 'clinicStaff' : 'platformStaff'

      // Find and delete related profile records
      const profileQuery = await payload.find({
        collection: profileCollection,
        where: {
          user: { equals: id },
        },
        limit: 10, // Safety limit to prevent accidental mass deletion
        req,
        overrideAccess: true, // Bypass access controls for hook-based operations
      })

      if (profileQuery.docs.length > 0) {
        // Delete each profile record
        for (const profile of profileQuery.docs) {
          try {
            await payload.delete({
              collection: profileCollection,
              id: profile.id,
              req,
              overrideAccess: true, // Bypass access controls for hook-based deletion
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
            // Continue with other profiles even if one fails
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

    // Now delete the Supabase user
    if (userDoc.supabaseUserId) {
      payload.logger.info(`Deleting Supabase user for BasicUser: ${id}`, {
        supabaseUserId: userDoc.supabaseUserId,
        userEmail: userDoc.email,
      })

      // Delete the Supabase user
      const supabase = await createAdminClient()
      const { error } = await supabase.auth.admin.deleteUser(userDoc.supabaseUserId)

      if (error) {
        payload.logger.error(`Failed to delete Supabase user: ${userDoc.supabaseUserId}`, {
          error: error.message,
          basicUserId: id,
        })
        // Don't throw - allow PayloadCMS deletion to continue
        // Supabase user can be cleaned up manually if needed
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
    // Don't throw - allow PayloadCMS deletion to continue
  }
}
