import type { CollectionBeforeChangeHook } from 'payload'
import type { BasicUser } from '../../payload-types'
import { createSupabaseAccount } from '@/auth/utilities/supabaseProvision'

/** beforeChange(create): provision Supabase user for new BasicUser; abort creation on failure. */
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

  const { payload } = req

  try {
    payload.logger.info(`Creating Supabase user for BasicUser: ${data.email}`, {
      userType: data.userType,
      operation,
    })

    if (!data.password) {
      throw new Error('Password is required to create a BasicUser')
    }

    // Get user metadata from context if available (e.g., first-admin registration)
    const userMetadata = req.context?.userMetadata as { firstName?: string; lastName?: string } | undefined

    // Create user in Supabase via shared provision helper
    const supabaseUserId = await createSupabaseAccount({
      email: data.email!,
      password: data.password,
      userType: data.userType!,
      userMetadata,
    })

    payload.logger.info(`Successfully created Supabase user for BasicUser: ${data.email}`, {
      supabaseUserId,
      userType: data.userType,
    })

    return {
      ...data,
      supabaseUserId,
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
