import type { CollectionBeforeDeleteHook } from 'payload'
import type { BasicUser } from '@/payload-types'
import { deleteSupabaseUser } from '@/auth/utilities/registration'

/**
 * Generic function to delete associated BasicUser and Supabase user for staff profiles
 */
async function deleteAssociatedUserRecords(
  req: any,
  staffRecord: any,
  staffType: 'platform' | 'clinic',
  staffId: string | number,
) {
  if (!staffRecord || typeof staffRecord.user !== 'object' || !staffRecord.user) {
    throw new Error(`${staffType} staff record not found or missing user relationship`)
  }

  const basicUser = staffRecord.user as BasicUser
  const supabaseUserId = basicUser.supabaseUserId

  if (!supabaseUserId) {
    throw new Error('Supabase user ID not found in basic user record')
  }

  req.payload.logger.info(
    `Deleting associated BasicUser and Supabase user for ${staffType}Staff ${staffId}`,
  )

  // Set context to prevent infinite loops
  const context = { ...req.context, deletingFromProfile: true }

  // Delete the BasicUser record
  await req.payload.delete({
    collection: 'basicUsers',
    id: basicUser.id,
    overrideAccess: true,
    req: { ...req, context },
  })

  // Delete the Supabase user
  await deleteSupabaseUser(supabaseUserId)

  req.payload.logger.info(
    `Successfully deleted associated user records for ${staffType}Staff ${staffId}`,
  )
}

/**
 * Hook to automatically delete associated BasicUser and Supabase user when PlatformStaff is deleted
 */
export const deletePlatformStaffUserHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  try {
    const platformStaff = await req.payload.findByID({
      collection: 'platformStaff',
      id,
      overrideAccess: true,
    })

    await deleteAssociatedUserRecords(req, platformStaff, 'platform', id)
  } catch (error) {
    req.payload.logger.error(`Error deleting user records for PlatformStaff ${id}:`, error)
    throw error
  }
}

/**
 * Hook to automatically delete associated BasicUser and Supabase user when ClinicStaff is deleted
 */
export const deleteClinicStaffUserHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  try {
    const clinicStaff = await req.payload.findByID({
      collection: 'clinicStaff',
      id,
      overrideAccess: true,
    })

    await deleteAssociatedUserRecords(req, clinicStaff, 'clinic', id)
  } catch (error) {
    req.payload.logger.error(`Error deleting user records for ClinicStaff ${id}:`, error)
    throw error
  }
}

/**
 * Hook to automatically delete associated profile records when BasicUser is deleted
 * This ensures cleanup when deleting from the BasicUsers collection directly
 */
export const deleteBasicUserProfilesHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  // Skip if this deletion is triggered from a profile deletion to prevent infinite loops
  if (req.context?.deletingFromProfile) {
    return
  }

  try {
    // Get the basic user record to determine user type
    const basicUser = await req.payload.findByID({
      collection: 'basicUsers',
      id,
      overrideAccess: true,
    })

    if (!basicUser) {
      return
    }

    req.payload.logger.info(`Cleaning up profile records for ${basicUser.userType} user ${id}`)

    // Set context to prevent infinite loops
    const context = { ...req.context, deletingFromUser: true }

    if (basicUser.userType === 'platform') {
      // Find and delete associated PlatformStaff record
      const platformStaffResults = await req.payload.find({
        collection: 'platformStaff',
        where: {
          user: { equals: id },
        },
        limit: 1,
        overrideAccess: true,
      })

      if (platformStaffResults.docs.length > 0 && platformStaffResults.docs[0]) {
        await req.payload.delete({
          collection: 'platformStaff',
          id: platformStaffResults.docs[0].id,
          overrideAccess: true,
          req: { ...req, context },
        })
      }
    } else if (basicUser.userType === 'clinic') {
      // Find and delete associated ClinicStaff record
      const clinicStaffResults = await req.payload.find({
        collection: 'clinicStaff',
        where: {
          user: { equals: id },
        },
        limit: 1,
        overrideAccess: true,
      })

      if (clinicStaffResults.docs.length > 0 && clinicStaffResults.docs[0]) {
        await req.payload.delete({
          collection: 'clinicStaff',
          id: clinicStaffResults.docs[0].id,
          overrideAccess: true,
          req: { ...req, context },
        })
      }
    }

    // Delete the Supabase user if we have the ID
    if (basicUser.supabaseUserId) {
      await deleteSupabaseUser(basicUser.supabaseUserId)
      req.payload.logger.info(`Deleted Supabase user ${basicUser.supabaseUserId}`)
    }
  } catch (error) {
    req.payload.logger.error(`Error cleaning up profile records for BasicUser ${id}:`, error)
    // Re-throw to prevent the deletion if cleanup fails
    throw error
  }
}

/**
 * Hook to automatically delete Supabase user when Patient is deleted
 */
export const deletePatientUserHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  try {
    // Get the patient record to find supabase user ID
    const patient = await req.payload.findByID({
      collection: 'patients',
      id,
      overrideAccess: true,
    })

    if (patient && patient.supabaseUserId) {
      req.payload.logger.info(`Deleting Supabase user for Patient ${id}`)

      // Delete the Supabase user
      await deleteSupabaseUser(patient.supabaseUserId)

      req.payload.logger.info(`Successfully deleted Supabase user for Patient ${id}`)
    }
  } catch (error) {
    req.payload.logger.error(`Error deleting Supabase user for Patient ${id}:`, error)
    // Re-throw to prevent the deletion if user deletion fails
    throw error
  }
}
