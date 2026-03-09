import type { CollectionBeforeChangeHook } from 'payload'
import type { BasicUser } from '@/payload-types'
import { inviteSupabaseAccount } from '@/auth/utilities/supabaseProvision'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { hashLogValue } from '@/utilities/logging/shared'

export const createSupabaseUserHook: CollectionBeforeChangeHook<BasicUser> = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (req.context?.skipSupabaseUserCreation) return data
  if (data.supabaseUserId) return data
  const normalizedEmail = normalizeEmail(data.email)
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Supabase user creation failed: Invalid email format')
  }
  const { payload } = req
  const ctx = req.context?.userMetadata as { firstName?: string; lastName?: string } | undefined
  const userMetadata = {
    firstName: ctx?.firstName || data.firstName,
    lastName: ctx?.lastName || data.lastName,
  }
  let supabaseUserId: string
  try {
    supabaseUserId = await inviteSupabaseAccount(
      {
        email: normalizedEmail,
        userType: data.userType!,
        userMetadata,
      },
      req.payload.logger,
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Keep message format expected by unit tests
    throw new Error(`Supabase user creation failed: ${message}`)
  }
  payload.logger.info(
    {
      event: 'auth.supabase.hook.basic_user_created',
      supabaseUserId,
      userEmailHash: hashLogValue(normalizedEmail),
      userType: data.userType,
    },
    'Successfully created Supabase user for BasicUser',
  )
  return {
    ...data,
    email: normalizedEmail,
    supabaseUserId,
  }
}
