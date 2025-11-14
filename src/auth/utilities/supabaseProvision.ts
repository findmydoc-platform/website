import {
  createSupabaseInviteConfig,
  createSupabaseUser,
  createSupabaseUserConfig,
  type BaseRegistrationData,
  type SupabaseInviteConfig,
} from '@/auth/utilities/registration'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'

export interface InviteProvisionArgs {
  email: string
  userType: 'platform' | 'clinic' | 'patient'
  userMetadata?: { firstName?: string; lastName?: string }
}

/**
 * Sends a Supabase invite and returns the Supabase user id once metadata has been applied.
 */
export async function inviteSupabaseAccount({
  email,
  userType,
  userMetadata,
}: InviteProvisionArgs): Promise<string> {
  const reg: BaseRegistrationData = {
    email,
    password: null,
    firstName: userMetadata?.firstName || '',
    lastName: userMetadata?.lastName || '',
  }

  const inviteConfig = createSupabaseInviteConfig(reg)
  const invitedUser = await inviteSupabaseUser(inviteConfig, userType)
  return invitedUser.id
}

export interface DirectProvisionArgs extends InviteProvisionArgs {
  password: string
}

/**
 * Creates a Supabase user directly with the provided password and returns the Supabase user id.
 */
export async function createSupabaseAccountWithPassword({
  email,
  password,
  userType,
  userMetadata,
}: DirectProvisionArgs): Promise<string> {
  const reg: BaseRegistrationData = {
    email,
    password,
    firstName: userMetadata?.firstName || '',
    lastName: userMetadata?.lastName || '',
  }

  const config = createSupabaseUserConfig(reg, userType)
  const supabaseUser = await createSupabaseUser(config)
  return supabaseUser.id
}

export async function inviteSupabaseUser(
  config: SupabaseInviteConfig,
  userType: InviteProvisionArgs['userType'],
): Promise<{ id: string }> {
  const supabase = await createAdminClient()

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(config.email, {
    data: config.user_metadata,
  })

  if (error) {
    console.error('Failed to invite Supabase user:', error)
    throw new Error(`Supabase user invite failed: ${error.message}`)
  }

  const user = data.user
  if (!user) {
    throw new Error('Supabase invite succeeded but no user data returned')
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { user_type: userType },
  })

  if (updateError) {
    console.error('Failed to update Supabase user metadata after invite:', updateError)
    throw new Error(`Supabase invite metadata update failed: ${updateError.message}`)
  }

  return user
}

/**
 * Deletes a Supabase user by id. Never throws; returns true on success, false on failure.
 */
export async function deleteSupabaseAccount(supabaseUserId: string): Promise<boolean> {
  try {
    const supabase = await createAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(supabaseUserId)
    if (error) return false
    return true
  } catch {
    return false
  }
}
