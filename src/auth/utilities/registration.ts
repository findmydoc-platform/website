import { createAdminClient } from './supaBaseServer'

// Registration data types
export interface BaseRegistrationData {
  email: string
  password: string
  firstName: string
  lastName: string
}

// Supabase user creation configuration
export interface SupabaseUserConfig {
  email: string
  password: string
  user_metadata: Record<string, any>
  app_metadata: Record<string, any>
  email_confirm: boolean
}

// Create a Supabase user with common error handling
export async function createSupabaseUser(config: SupabaseUserConfig) {
  const supabase = await createAdminClient()

  const { data, error } = await supabase.auth.admin.createUser(config)

  if (error) {
    console.error('Failed to create Supabase user:', error)
    throw new Error(`Supabase user creation failed: ${error.message}`)
  }

  if (!data.user) {
    throw new Error('Supabase user creation succeeded but no user data returned')
  }

  return data.user
}

//patient, clinic, platform
export function createSupabaseUserConfig(data: BaseRegistrationData, userType: string): SupabaseUserConfig {
  if (!['patient', 'clinic', 'platform'].includes(userType)) {
    throw new Error(`Invalid user type: ${userType}. Must be one of 'patient', 'clinic', or 'platform'.`)
  }

  return {
    email: data.email,
    password: data.password,
    user_metadata: {
      first_name: data.firstName,
      last_name: data.lastName,
    },
    app_metadata: {
      user_type: userType,
    },
    email_confirm: true,
  }
}

// Validate that no platform users exist (for first admin creation)
export async function validateFirstAdminCreation(): Promise<string | null> {
  const supabase = await createAdminClient()

  const { data: existingUsers, error: fetchError } = await supabase.auth.admin.listUsers()
  if (fetchError) {
    throw new Error(`Failed to verify first user status: ${fetchError.message}`)
  }

  const platformUsers = existingUsers?.users?.filter((user) => user.app_metadata?.user_type === 'platform') || []

  if (platformUsers.length > 0) {
    return 'At least one Admin user already exists'
  }

  return null
}
