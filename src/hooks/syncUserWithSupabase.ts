import type { CollectionBeforeChangeHook, CollectionAfterChangeHook } from 'payload'
import { createSupabaseUser, createPlatformStaffUserConfig } from '@/auth/utilities/registration'
import type { BasicUser, PlatformStaff } from '@/payload-types'

export const createSupabaseUserHook: CollectionBeforeChangeHook<BasicUser> = async ({
  data,
  req,
  operation,
}) => {
  // Only run on create operations when creating from admin panel
  if (operation !== 'create' || !data || data.supabaseUserId) {
    return data
  }

  // Only run for platform users (admins creating other admins)
  if (data.userType !== 'platform') {
    return data
  }

  // Validate email is provided
  if (!data.email) {
    throw new Error('Email is required to create a new admin user')
  }

  try {
    // Generate a temporary password - in production, you might want to send an email
    const tempPassword = generateTempPassword()

    const registrationData = {
      email: data.email,
      password: tempPassword,
      firstName: 'New', // Default values since BasicUser doesn't store names
      lastName: 'Admin',
    }

    // Create user in Supabase
    const userConfig = createPlatformStaffUserConfig(registrationData)
    const supabaseUser = await createSupabaseUser(userConfig)

    req.payload.logger.info(
      `Created Supabase user ${supabaseUser.id} for admin-created user ${data.email}`,
    )

    // Update the data with Supabase user ID
    return {
      ...data,
      supabaseUserId: supabaseUser.id,
      tempPassword, // Store temporarily so we can show it to the admin
    }
  } catch (error) {
    req.payload.logger.error('Failed to create Supabase user during admin creation:', error)
    throw new Error(
      `Failed to create user in authentication system: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * Hook to create corresponding PlatformStaff profile after BasicUser is created
 */
export const createPlatformStaffProfileHook: CollectionAfterChangeHook<BasicUser> = async ({
  doc,
  req,
  operation,
}) => {
  // Only run on create operations for platform users
  if (operation !== 'create' || !doc || doc.userType !== 'platform') {
    return doc
  }

  try {
    // Check if profile already exists
    const existingProfile = await req.payload.find({
      collection: 'platformStaff',
      where: {
        user: { equals: doc.id },
      },
      limit: 1,
    })

    if (existingProfile.docs.length === 0) {
      // Create PlatformStaff profile with default values
      await req.payload.create({
        collection: 'platformStaff',
        data: {
          user: doc.id,
          email: doc.email,
          firstName: 'New', // Default values - admin can edit these later
          lastName: 'Admin',
          role: 'admin', // Default role for admin-created users
        },
      })

      req.payload.logger.info(`Created PlatformStaff profile for user ${doc.id}`)
    }

    return doc
  } catch (error) {
    req.payload.logger.error('Failed to create PlatformStaff profile:', error)
    // Don't throw here to avoid breaking the user creation
    return doc
  }
}

/**
 * Generate a temporary password for new admin users
 * In production, you'd want to send this via email and force password reset
 */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// ========== NEW HOOKS FOR PLATFORM STAFF ADMIN CREATION ==========

/**
 * Hook to create BasicUser and Supabase user when a PlatformStaff is created
 * This enables admins to create new admin users directly from PlatformStaff collection
 */
export const createBasicUserForPlatformStaffHook: CollectionBeforeChangeHook<
  PlatformStaff
> = async ({ data, req, operation }) => {
  // Only run on create operations
  if (operation !== 'create' || !data || data.user) {
    return data
  }

  // Validate email is provided
  if (!data.email) {
    throw new Error('Email is required to create a new admin user')
  }

  try {
    // Generate a temporary password
    const tempPassword = generateTempPassword()

    const registrationData = {
      email: data.email,
      password: tempPassword,
      firstName: data.firstName || 'New',
      lastName: data.lastName || 'Admin',
    }

    // Create user in Supabase
    const userConfig = createPlatformStaffUserConfig(registrationData)
    const supabaseUser = await createSupabaseUser(userConfig)

    req.payload.logger.info(
      `Created Supabase user ${supabaseUser.id} for admin-created user ${data.email}`,
    )

    // Create the BasicUser record
    const basicUser = await req.payload.create({
      collection: 'basicUsers',
      data: {
        email: data.email,
        supabaseUserId: supabaseUser.id,
        userType: 'platform',
      },
    })

    req.payload.logger.info(
      `Created BasicUser ${basicUser.id} for admin-created user ${data.email}`,
    )

    // Update the data with the created user relationship and temp password
    return {
      ...data,
      user: basicUser.id,
      tempPassword, // Store temporarily so we can show it to the admin
    } as any // Type assertion needed due to tempPassword being a custom field
  } catch (error) {
    req.payload.logger.error('Failed to create user during PlatformStaff creation:', error)
    throw new Error(
      `Failed to create user in authentication system: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * Hook to schedule cleanup of temporary password after PlatformStaff is created
 */
export const cleanupTempPasswordHook: CollectionAfterChangeHook<PlatformStaff> = async ({
  doc,
  req,
  operation,
}) => {
  // Only run on create operations when temp password exists
  if (operation !== 'create' || !doc || !(doc as any).tempPassword) {
    return doc
  }

  // Schedule clearing of temporary password after 24 hours for security
  setTimeout(
    async () => {
      try {
        await req.payload.update({
          collection: 'platformStaff',
          id: doc.id,
          data: {
            tempPassword: null,
          } as any, // Type assertion needed due to tempPassword being a custom field
        })
        req.payload.logger.info(`Cleared temporary password for PlatformStaff ${doc.id}`)
      } catch (error) {
        req.payload.logger.error(
          `Failed to clear temporary password for PlatformStaff ${doc.id}:`,
          error,
        )
      }
    },
    24 * 60 * 60 * 1000,
  ) // 24 hours

  return doc
}
