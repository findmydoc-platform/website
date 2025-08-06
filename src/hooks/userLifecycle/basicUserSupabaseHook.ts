import type { CollectionBeforeChangeHook } from 'payload'
import type { BasicUser } from '../../payload-types'
import { createSupabaseUser, createSupabaseUserConfig } from '@/auth/utilities/registration'
import { generateSecurePassword } from '@/auth/utilities/passwordGeneration'

/**
 * Hook that creates a Supabase user when a BasicUser is created in PayloadCMS.
 * This ensures all BasicUsers have corresponding Supabase auth accounts.
 *
 * Features:
 * - Creates Supabase user with temporary password for admin-created users
 * - Stores supabaseUserId back to BasicUser record
 * - Handles errors gracefully with proper rollback
 * - Comprehensive logging for debugging
 */
export const createSupabaseUserHook: CollectionBeforeChangeHook<BasicUser> = async ({ data, operation, req }) => {
  // Only run on user creation
  if (operation !== 'create') {
    return data
  }

  // Skip if supabaseUserId is already provided (e.g., from auth strategy)
  if (data.supabaseUserId) {
    req.payload.logger.info(`BasicUser creation with existing supabaseUserId: ${data.supabaseUserId}`)
    return data
  }

  // Skip if context indicates this should be skipped (prevents loops)
  if (req.context?.skipSupabaseCreation) {
    req.payload.logger.info('Skipping Supabase user creation due to context flag')
    return data
  }

  const { payload } = req

  try {
    payload.logger.info(`Creating Supabase user for BasicUser: ${data.email}`, {
      userType: data.userType,
      operation,
    })

    // Generate secure temporary password for admin-created users
    const temporaryPassword = generateSecurePassword()

    // Prepare registration data for Supabase
    const registrationData = {
      email: data.email!, // email is required in BasicUser, so this should be safe
      password: temporaryPassword,
      firstName: 'Unknown', // Will be updated when user completes profile
      lastName: 'User',
    }

    // Create Supabase user configuration
    const userConfig = createSupabaseUserConfig(registrationData, data.userType!)

    // Create user in Supabase
    const supabaseUser = await createSupabaseUser(userConfig)

    payload.logger.info(`Successfully created Supabase user for BasicUser: ${data.email}`, {
      supabaseUserId: supabaseUser.id,
      userType: data.userType,
    })

    // Store temporary password in context for afterChange hook to display
    if (!req.context) {
      req.context = {}
    }
    req.context.temporaryPassword = temporaryPassword

    // Store the Supabase user ID and temporary password back to the BasicUser record
    return {
      ...data,
      supabaseUserId: supabaseUser.id,
      temporaryPassword, // Store password in the database field for admin visibility
    }
  } catch (error: any) {
    payload.logger.error(`Failed to create Supabase user for BasicUser: ${data.email}`, {
      error: error.message,
      userType: data.userType,
      stack: error.stack,
    })

    // Throw error to prevent BasicUser creation if Supabase creation fails
    // This ensures data consistency - we don't want BasicUsers without Supabase accounts
    throw new Error(`Supabase user creation failed: ${error.message}`)
  }
}
