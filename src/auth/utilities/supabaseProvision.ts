import {
  createSupabaseInviteConfig,
  createSupabaseUser,
  createSupabaseUserConfig,
  type BaseRegistrationData,
  type SupabaseInviteConfig,
} from '@/auth/utilities/registration'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { getLoggedSupabaseAdminClient, getSupabaseLogger } from './supabaseLogger'
import { hashLogValue, toLoggedError, type ServerLogger } from '@/utilities/logging/shared'

type SupabaseUserType = 'platform' | 'clinic' | 'patient'

interface SupabaseProvisionMetadata {
  firstName?: string
  lastName?: string
}

interface BaseProvisionArgs {
  email: string
  userType: SupabaseUserType
  userMetadata?: SupabaseProvisionMetadata
}

export interface InviteProvisionArgs extends BaseProvisionArgs {
  password?: null
}

export interface DirectProvisionArgs extends BaseProvisionArgs {
  password: string
}

const resolveSupabaseProvisionLogger = (logger?: ServerLogger) =>
  getSupabaseLogger({
    bindings: {
      component: 'supabase-provision',
    },
    logger,
  })

async function logProvisionError(
  logger: ServerLogger | undefined,
  message: string,
  error: unknown,
  meta?: Record<string, unknown>,
) {
  const activeLogger = await resolveSupabaseProvisionLogger(logger)
  activeLogger.error(
    {
      ...meta,
      err: toLoggedError(error),
    },
    message,
  )
}

async function getProvisionAdminClient(
  logger?: ServerLogger,
  meta: Record<string, unknown> = {},
): Promise<{
  activeLogger: Awaited<ReturnType<typeof resolveSupabaseProvisionLogger>>
  supabase: Awaited<ReturnType<typeof getLoggedSupabaseAdminClient>>['supabase']
}> {
  return getLoggedSupabaseAdminClient({
    component: 'supabase-provision',
    logger,
    meta,
  })
}

/**
 * Sends a Supabase invite and returns the Supabase user id once metadata has been applied.
 */
export async function inviteSupabaseAccount(
  { email, userType, userMetadata }: InviteProvisionArgs,
  logger?: ServerLogger,
): Promise<string> {
  const normalizedEmail = normalizeEmail(email)
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Supabase user invite failed: Invalid email format')
  }

  const reg: BaseRegistrationData = {
    email: normalizedEmail,
    password: null,
    firstName: userMetadata?.firstName || '',
    lastName: userMetadata?.lastName || '',
  }

  const inviteConfig = createSupabaseInviteConfig(reg)
  const invitedUser = await inviteSupabaseUser(inviteConfig, userType, '/auth/invite/complete', logger)
  return invitedUser.id
}

/**
 * Creates a Supabase user directly with the provided password and returns the Supabase user id.
 */
export async function createSupabaseAccountWithPassword(
  { email, password, userType, userMetadata }: DirectProvisionArgs,
  logger?: ServerLogger,
): Promise<string> {
  if (!password) {
    throw new Error('Password is required to create a Supabase user with direct provisioning')
  }
  const normalizedEmail = normalizeEmail(email)
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Supabase user creation failed: Invalid email format')
  }

  const reg: BaseRegistrationData & { password: string } = {
    email: normalizedEmail,
    password,
    firstName: userMetadata?.firstName || '',
    lastName: userMetadata?.lastName || '',
  }

  const config = createSupabaseUserConfig(reg, userType)
  const supabaseUser = await createSupabaseUser(config, logger)
  return supabaseUser.id
}

/**
 * @internal Use inviteSupabaseAccount unless you need fine-grained control over the invite payload.
 */
export async function inviteSupabaseUser(
  config: SupabaseInviteConfig,
  userType: InviteProvisionArgs['userType'],
  redirectPath = '/auth/invite/complete',
  logger?: ServerLogger,
): Promise<{ id: string }> {
  const { activeLogger, supabase } = await getProvisionAdminClient(logger, {
    emailHash: hashLogValue(config.email),
    operation: 'invite_user',
    userType,
  })

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const redirectTo = `${baseUrl}/auth/callback?next=${redirectPath}`
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(config.email, {
    data: config.user_metadata,
    redirectTo,
  })

  if (error) {
    await logProvisionError(logger, 'Failed to invite Supabase user', error, {
      emailHash: hashLogValue(config.email),
      event: 'auth.supabase.admin.invite_failed',
      userType,
    })
    throw new Error(`Supabase user invite failed: ${error.message}`)
  }

  const user = data.user
  if (!user) {
    activeLogger.error(
      {
        emailHash: hashLogValue(config.email),
        event: 'auth.supabase.admin.invite_missing_payload',
        userType,
      },
      'Supabase invite returned no user payload',
    )
    throw new Error('Supabase invite succeeded but no user data returned')
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { user_type: userType },
  })

  if (updateError) {
    await logProvisionError(logger, 'Failed to apply Supabase invite metadata', updateError, {
      emailHash: hashLogValue(config.email),
      event: 'auth.supabase.admin.invite_metadata_failed',
      userType,
      supabaseUserId: user.id,
    })
    throw new Error(`Supabase invite metadata update failed: ${updateError.message}`)
  }

  activeLogger.info(
    {
      emailHash: hashLogValue(config.email),
      event: 'auth.supabase.admin.invite_succeeded',
      supabaseUserId: user.id,
      userType,
    },
    'Invited Supabase user',
  )

  return user
}

/**
 * Deletes a Supabase user by id. Never throws; returns true on success, false on failure.
 */
export async function deleteSupabaseAccount(supabaseUserId: string): Promise<boolean> {
  try {
    const { activeLogger, supabase } = await getProvisionAdminClient(undefined, {
      operation: 'delete_user',
      supabaseUserId,
    })
    const { error } = await supabase.auth.admin.deleteUser(supabaseUserId)
    if (error) {
      activeLogger.error(
        {
          err: error,
          event: 'auth.supabase.admin.delete_user_failed',
          supabaseUserId,
        },
        'Failed to delete Supabase user',
      )
      return false
    }
    return true
  } catch {
    return false
  }
}
