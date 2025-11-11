import type { CollectionBeforeChangeHook } from 'payload'
import type { BasicUser } from '@/payload-types'
import { createSupabaseAccount } from '@/auth/utilities/supabaseProvision'

export const createSupabaseUserHook: CollectionBeforeChangeHook<BasicUser> = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (data.supabaseUserId) return data
  const { payload } = req
  if (!data.password) throw new Error('Password is required to create a BasicUser')
  const ctx = req.context?.userMetadata as { firstName?: string; lastName?: string } | undefined
  const userMetadata = {
    firstName: ctx?.firstName || (data as any).firstName,
    lastName: ctx?.lastName || (data as any).lastName,
  }
  let supabaseUserId: string
  try {
    supabaseUserId = await createSupabaseAccount({
      email: data.email!,
      password: data.password,
      userType: data.userType!,
      userMetadata,
    })
  } catch (err: any) {
    const message = err?.message ?? String(err)
    // Keep message format expected by unit tests
    throw new Error(`Supabase user creation failed: ${message}`)
  }
  payload.logger.info(
    { supabaseUserId, userType: data.userType },
    `Successfully created Supabase user for BasicUser: ${data.email}`,
  )
  return { ...data, supabaseUserId }
}
