import type { CollectionBeforeChangeHook, CollectionAfterChangeHook } from 'payload'
import type { PlatformStaff, ClinicStaff } from '@/payload-types'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'

/**
 * Generate a secure temporary password
 */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Hook for creating users when staff records are created
 * Handles Supabase user creation and BasicUser creation directly
 */
export const createUserHook = <T extends PlatformStaff | ClinicStaff>(
  userType: 'platform' | 'clinic',
): CollectionBeforeChangeHook<T> => {
  return async ({ data, req, operation }) => {
    // Only run on create operations when no user relationship exists
    if (operation !== 'create' || !data || data.user) {
      return data
    }

    // Validate required fields
    if (!data.email || !data.firstName || !data.lastName) {
      throw new Error('Email, first name, and last name are required to create a new user')
    }

    try {
      // 1. Generate temporary password
      const tempPassword = generateTempPassword()

      // 2. Create user in Supabase
      const supabase = await createAdminClient()
      const { data: supabaseResult, error } = await supabase.auth.admin.createUser({
        email: data.email,
        password: tempPassword,
        user_metadata: {
          first_name: data.firstName,
          last_name: data.lastName,
        },
        app_metadata: {
          user_type: userType,
        },
        email_confirm: true,
      })

      if (error || !supabaseResult.user) {
        throw new Error(`Supabase user creation failed: ${error?.message || 'No user returned'}`)
      }

      req.payload.logger.info(`Created Supabase user: ${supabaseResult.user.id}`)

      // 3. Create BasicUser record
      const basicUser = await req.payload.create({
        collection: 'basicUsers',
        data: {
          email: data.email,
          supabaseUserId: supabaseResult.user.id,
          userType: userType as 'platform' | 'clinic',
        },
        overrideAccess: true,
      })

      req.payload.logger.info(`Created user account for ${userType} staff: ${data.email}`)

      // 4. Return updated data with user relationship and temp password
      return {
        ...data,
        user: basicUser.id,
        tempPassword: tempPassword,
      } as T
    } catch (error) {
      req.payload.logger.error(`Failed to create user for ${userType} staff:`, error)
      throw new Error(`Failed to create user account: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

/**
 * Hook to schedule cleanup of temporary passwords
 * Clears temp password after 1 minute for security
 */
export const schedulePasswordCleanupHook = <T extends PlatformStaff | ClinicStaff>(): CollectionAfterChangeHook<T> => {
  return async ({ doc, req, operation }) => {
    // Only run on create operations when temp password exists
    if (operation !== 'create' || !doc || !(doc as any).tempPassword) {
      return doc
    }

    // Schedule cleanup after 24 hours
    setTimeout(
      async () => {
        try {
          const collectionName =
            'user' in doc ? ((doc as any).role !== undefined ? 'platformStaff' : 'clinicStaff') : 'platformStaff' // fallback

          await req.payload.update({
            collection: collectionName,
            id: doc.id,
            data: { tempPassword: null },
            overrideAccess: true,
          })

          req.payload.logger.info(`Cleared temporary password for ${collectionName}: ${doc.id}`)
        } catch (error) {
          req.payload.logger.error(`Failed to clear temp password for ${doc.id}:`, error)
        }
      },
      60 * 1000, // 1 minute
    )

    return doc
  }
}

// Export pre-configured hooks for each user type
export const createPlatformUserHook = createUserHook<PlatformStaff>('platform')
export const createClinicUserHook = createUserHook<ClinicStaff>('clinic')
export const cleanupPlatformPasswordHook = schedulePasswordCleanupHook<PlatformStaff>()
export const cleanupClinicPasswordHook = schedulePasswordCleanupHook<ClinicStaff>()
