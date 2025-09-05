import { createSupabaseUser, createSupabaseUserConfig, type BaseRegistrationData } from '@/auth/utilities/registration'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'

export interface ProvisionArgs {
  email: string
  password: string | null | undefined
  userType: 'platform' | 'clinic' | 'patient'
  userMetadata?: { firstName?: string; lastName?: string }
}

/**
 * Creates a Supabase user and returns its id. Throws on failure.
 */
export async function createSupabaseAccount({
  email,
  password,
  userType,
  userMetadata,
}: ProvisionArgs): Promise<string> {
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
