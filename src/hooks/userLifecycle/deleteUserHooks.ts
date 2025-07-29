import type { CollectionBeforeDeleteHook } from 'payload'
import type { BasicUser, PlatformStaff, ClinicStaff, Patient } from '@/payload-types'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'

/**
 * Delete a user from Supabase with graceful error handling
 */
async function deleteSupabaseUser(supabaseUserId: string): Promise<void> {
  const supabase = await createAdminClient()

  // First check if user exists
  const { data: userData, error: fetchError } = await supabase.auth.admin.getUserById(supabaseUserId)

  if (fetchError) {
    // If user not found, consider it successfully deleted
    if (fetchError.message?.includes('User not found') || fetchError.status === 404) {
      console.warn(`Supabase user ${supabaseUserId} was already deleted or doesn't exist`)
      return
    }
    throw new Error(`Failed to verify user status: ${fetchError.message}`)
  }

  if (!userData.user) {
    console.warn(`Supabase user ${supabaseUserId} was already deleted`)
    return
  }

  // User exists, proceed with deletion
  const { error } = await supabase.auth.admin.deleteUser(supabaseUserId)

  if (error) {
    // Double-check for "already deleted" errors during deletion
    if (error.message?.includes('User not found') || error.status === 404) {
      console.warn(`Supabase user ${supabaseUserId} was deleted during deletion attempt`)
      return
    }
    throw new Error(`User deletion failed: ${error.message}`)
  }

  console.log(`Successfully deleted Supabase user ${supabaseUserId}`)
}

/**
 * Generic deletion hook that handles user deletion directly
 * No service layer - everything handled in the hook
 */
export const createDeleteUserHook = <T>(
  userType: 'platform' | 'clinic' | 'patient',
  getUserId: (record: T) => string | number,
  getSupabaseUserId?: (record: T) => string,
): CollectionBeforeDeleteHook => {
  return async ({ req, id }) => {
    // Skip if this deletion is triggered by cascade to prevent infinite loops
    if (req.context?.deletingFromProfile || req.context?.deletingFromUser) {
      req.payload.logger.info(`Skipping ${userType} deletion hook for ${id} due to context flag`)
      return
    }

    try {
      req.payload.logger.info(`Starting deletion process for ${userType} user: ${id}`)

      // Set context to prevent infinite loops FIRST
      req.context = { ...req.context, deletingFromProfile: true }

      // Fetch the record to get necessary IDs
      const collectionName =
        userType === 'patient' ? 'patients' : userType === 'platform' ? 'platformStaff' : 'clinicStaff'

      const record = (await req.payload.findByID({
        collection: collectionName,
        id,
        overrideAccess: true,
      })) as T

      if (!record) {
        req.payload.logger.warn(`${userType} record ${id} not found for deletion`)
        return
      }

      // Get Supabase user ID
      const supabaseUserId = getSupabaseUserId?.(record)

      // Delete from Supabase first
      if (supabaseUserId) {
        await deleteSupabaseUser(supabaseUserId)
        req.payload.logger.info(`Deleted Supabase user: ${supabaseUserId}`)
      }

      // For clinic and platform users, delete the BasicUser record
      if (userType === 'platform' || userType === 'clinic') {
        const profileRecord = record as any
        if (profileRecord.user) {
          const basicUserId = typeof profileRecord.user === 'object' ? profileRecord.user.id : profileRecord.user
          await req.payload.delete({
            collection: 'basicUsers',
            id: basicUserId,
            overrideAccess: true,
          })
          req.payload.logger.info(`Deleted BasicUser: ${basicUserId}`)
        }
      }

      req.payload.logger.info(`Successfully completed deletion process for ${userType} user: ${id}`)
    } catch (error) {
      req.payload.logger.error(`Error deleting ${userType} user ${id}:`, error)
      throw error
    }
  }
}

// Pre-configured hooks for each collection
export const deletePlatformStaffHook = createDeleteUserHook<PlatformStaff>(
  'platform',
  (record) => record.id,
  (record) => {
    const user = record.user as BasicUser
    return user?.supabaseUserId
  },
)

export const deleteClinicStaffHook = createDeleteUserHook<ClinicStaff>(
  'clinic',
  (record) => record.id,
  (record) => {
    const user = record.user as BasicUser
    return user?.supabaseUserId
  },
)

export const deletePatientHook = createDeleteUserHook<Patient>(
  'patient',
  (record) => record.id,
  (record) => record.supabaseUserId,
)
