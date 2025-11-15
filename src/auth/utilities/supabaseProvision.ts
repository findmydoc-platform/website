import {
  createSupabaseInviteConfig,
  createSupabaseUser,
  createSupabaseUserConfig,
  type BaseRegistrationData,
  type SupabaseInviteConfig,
} from '@/auth/utilities/registration'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import configPromise from '@/payload.config'
import { getPayload } from 'payload'

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

let payloadClientPromise: Promise<Awaited<ReturnType<typeof getPayload>>> | null = null

async function getPayloadLogger() {
  if (!payloadClientPromise) {
    payloadClientPromise = getPayload({ config: configPromise })
  }
  const payload = await payloadClientPromise
  return payload.logger
}

async function logProvisionError(message: string, error: unknown, meta?: Record<string, unknown>) {
  try {
    const logger = await getPayloadLogger()
    logger.error(
      {
        ...meta,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      },
      message,
    )
  } catch (loggerError) {
    console.error(message, { error, meta, loggerError })
  }
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

/**
 * Creates a Supabase user directly with the provided password and returns the Supabase user id.
 */
export async function createSupabaseAccountWithPassword({
  email,
  password,
  userType,
  userMetadata,
}: DirectProvisionArgs): Promise<string> {
  if (!password) {
    throw new Error('Password is required to create a Supabase user with direct provisioning')
  }
  const reg: BaseRegistrationData & { password: string } = {
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
 * @internal Use inviteSupabaseAccount unless you need fine-grained control over the invite payload.
 */
export async function inviteSupabaseUser(
  config: SupabaseInviteConfig,
  userType: InviteProvisionArgs['userType'],
): Promise<{ id: string }> {
  const supabase = await createAdminClient()

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(config.email, {
    data: config.user_metadata,
  })

  if (error) {
    await logProvisionError('Failed to invite Supabase user', error, {
      email: config.email,
      userType,
    })
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
    await logProvisionError('Failed to apply Supabase invite metadata', updateError, {
      email: config.email,
      userType,
      supabaseUserId: user.id,
    })
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
