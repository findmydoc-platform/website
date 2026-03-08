import { createAdminClient } from './supaBaseServer'
import { getServerLogger } from '@/utilities/logging/serverLogger'
import { createScopedLogger, getRequestLogContext, hashLogValue, type ServerLogger } from '@/utilities/logging/shared'

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

const getSupabaseAdminLogger = async (logger?: ServerLogger) => {
  const baseLogger =
    logger ??
    createScopedLogger(await getServerLogger(), {
      scope: 'auth.supabase',
      ...getRequestLogContext(),
    })

  return createScopedLogger(baseLogger, {
    component: 'supabase-admin',
  })
}

const getLoggedAdminClient = async (
  logger?: ServerLogger,
  meta: Record<string, unknown> = {},
): Promise<{
  activeLogger: Awaited<ReturnType<typeof getSupabaseAdminLogger>>
  supabase: Awaited<ReturnType<typeof createAdminClient>>
}> => {
  const activeLogger = await getSupabaseAdminLogger(logger)

  try {
    const supabase = await createAdminClient()
    return { activeLogger, supabase }
  } catch (error) {
    activeLogger.error(
      {
        ...meta,
        err: error instanceof Error ? error : new Error(String(error)),
        event: 'auth.supabase.admin.client_init_failed',
      },
      'Failed to initialize Supabase admin client',
    )
    throw error
  }
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

// Validate that no platform users exist (for first admin creation)
export async function validateFirstAdminCreation(logger?: ServerLogger): Promise<string | null> {
  const { activeLogger, supabase } = await getLoggedAdminClient(logger, {
    operation: 'list_users',
  })

  const { data: existingUsers, error: fetchError } = await supabase.auth.admin.listUsers()
  if (fetchError) {
    activeLogger.error(
      {
        err: fetchError,
        event: 'auth.supabase.admin.first_admin_check_failed',
      },
      'Failed to verify first admin creation status',
    )
    throw new Error(`Failed to verify first user status: ${fetchError.message}`)
  }

  const platformUsers = existingUsers?.users?.filter((user) => user.app_metadata?.user_type === 'platform') || []

  activeLogger.info(
    {
      event: 'auth.supabase.admin.first_admin_checked',
      platformUserCount: platformUsers.length,
    },
    'Validated first admin creation precondition',
  )

  if (platformUsers.length > 0) {
    return 'At least one Admin user already exists'
  }

  return null
}
