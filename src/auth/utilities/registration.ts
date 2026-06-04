import { getLoggedSupabaseAdminClient } from './supabaseLogger'
import { hashLogValue, type ServerLogger } from '@/utilities/logging/shared'

// Registration data types
export interface BaseRegistrationData {
  email: string
  password: string | null | undefined
  firstName: string
  lastName: string
}

// Supabase user creation configuration
export interface SupabaseUserConfig {
  email: string
  password: string
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
  email_confirm: boolean
}

export interface SupabaseInviteConfig {
  email: string
  user_metadata: Record<string, unknown>
}

const getLoggedAdminClient = async (
  logger?: ServerLogger,
  meta: Record<string, unknown> = {},
): Promise<{
  activeLogger: Awaited<ReturnType<typeof getLoggedSupabaseAdminClient>>['activeLogger']
  supabase: Awaited<ReturnType<typeof getLoggedSupabaseAdminClient>>['supabase']
}> => {
  return getLoggedSupabaseAdminClient({
    component: 'supabase-admin',
    logger,
    meta,
  })
}

// Create a Supabase user with common error handling
export async function createSupabaseUser(config: SupabaseUserConfig, logger?: ServerLogger) {
  const { activeLogger, supabase } = await getLoggedAdminClient(logger, {
    emailHash: hashLogValue(config.email),
    operation: 'create_user',
  })

  const { data, error } = await supabase.auth.admin.createUser(config)

  if (error) {
    activeLogger.error(
      {
        emailHash: hashLogValue(config.email),
        err: error,
        event: 'auth.supabase.admin.create_user_failed',
      },
      'Failed to create Supabase user',
    )
    throw new Error(`Supabase user creation failed: ${error.message}`)
  }

  if (!data.user) {
    activeLogger.error(
      {
        emailHash: hashLogValue(config.email),
        event: 'auth.supabase.admin.create_user_missing_payload',
      },
      'Supabase user creation returned no user payload',
    )
    throw new Error('Supabase user creation succeeded but no user data returned')
  }

  activeLogger.info(
    {
      emailHash: hashLogValue(config.email),
      event: 'auth.supabase.admin.create_user_succeeded',
      supabaseUserId: data.user.id,
    },
    'Created Supabase user',
  )

  return data.user
}

//patient, clinic, platform
export function createSupabaseUserConfig(
  data: BaseRegistrationData & { password: string },
  userType: string,
): SupabaseUserConfig {
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

export function createSupabaseInviteConfig(data: BaseRegistrationData): SupabaseInviteConfig {
  return {
    email: data.email,
    user_metadata: {
      first_name: data.firstName,
      last_name: data.lastName,
    },
  }
}
