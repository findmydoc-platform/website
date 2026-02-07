import type { CollectionBeforeChangeHook } from 'payload'
import type { BasicUser } from '@/payload-types'
import { inviteSupabaseAccount } from '@/auth/utilities/supabaseProvision'

export const createSupabaseUserHook: CollectionBeforeChangeHook<BasicUser> = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (req.context?.skipSupabaseUserCreation) return data
  if (data.supabaseUserId) return data
  const { payload } = req
  const ctx = req.context?.userMetadata as { firstName?: string; lastName?: string } | undefined
  const userMetadata = {
    firstName: ctx?.firstName || data.firstName,
    lastName: ctx?.lastName || data.lastName,
  }
  let supabaseUserId: string
  try {
    supabaseUserId = await inviteSupabaseAccount({
      email: data.email!,
      userType: data.userType!,
      userMetadata,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Keep message format expected by unit tests
    throw new Error(`Supabase user creation failed: ${message}`)
  }
  payload.logger.info(
    { supabaseUserId, userType: data.userType },
    `Successfully created Supabase user for BasicUser: ${data.email}`,
  )
  return {
    ...data,
    supabaseUserId,
  }
}
