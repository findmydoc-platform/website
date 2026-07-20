import {
  createSupabaseInviteConfig,
  createSupabaseUser,
  createSupabaseUserConfig,
  type BaseRegistrationData,
  type SupabaseInviteConfig,
} from '@/auth/utilities/registration'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import { getLoggedSupabaseAdminClient, getSupabaseLogger } from './supabaseLogger'
import { hashLogValue, toLoggedError, type ServerLogger } from '@/utilities/logging/shared'
import type { User } from '@supabase/supabase-js'

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

export interface ClinicInviteProvisionArgs {
  email: string
  onboardingKey: string
  userMetadata?: SupabaseProvisionMetadata
}

export interface ClinicAccountAccessArgs {
  enabled: boolean
  supabaseUserId: string
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

const toSupabaseErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : String(error)

const findClinicSupabaseUser = async (
  supabase: Awaited<ReturnType<typeof getProvisionAdminClient>>['supabase'],
  email: string,
  onboardingKey: string,
): Promise<User | null> => {
  const matches: User[] = []
  let page: number | null = 1

  while (page !== null) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) {
      throw new Error(`Supabase user reconciliation failed: ${error.message}`)
    }

    matches.push(
      ...data.users.filter(
        (user) => normalizeEmail(user.email) === email && user.user_metadata?.onboarding_key === onboardingKey,
      ),
    )
    page = data.nextPage
  }

  if (matches.length > 1) {
    throw new Error('Supabase user reconciliation found multiple clinic identities')
  }

  return matches[0] ?? null
}

const repairClinicSupabaseUser = async ({
  firstName,
  lastName,
  onboardingKey,
  supabase,
  user,
}: {
  firstName?: string
  lastName?: string
  onboardingKey: string
  supabase: Awaited<ReturnType<typeof getProvisionAdminClient>>['supabase']
  user: User
}): Promise<void> => {
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, user_type: 'clinic' },
    user_metadata: {
      ...user.user_metadata,
      first_name: firstName ?? user.user_metadata?.first_name,
      last_name: lastName ?? user.user_metadata?.last_name,
      onboarding_key: onboardingKey,
    },
  })

  if (error) {
    throw new Error(`Supabase clinic metadata update failed: ${error.message}`)
  }
}

/**
 * Invites the initial clinic principal and reconciles unknown invite responses by email and onboarding key.
 */
export async function inviteClinicSupabaseAccount(
  { email, onboardingKey, userMetadata }: ClinicInviteProvisionArgs,
  logger?: ServerLogger,
): Promise<string> {
  const normalizedEmail = normalizeEmail(email)
  const normalizedOnboardingKey = onboardingKey.trim()
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Supabase clinic invite failed: Invalid email format')
  }
  if (!normalizedOnboardingKey) {
    throw new Error('Supabase clinic invite failed: Missing onboarding key')
  }

  const { activeLogger, supabase } = await getProvisionAdminClient(logger, {
    emailHash: hashLogValue(normalizedEmail),
    onboardingKeyHash: hashLogValue(normalizedOnboardingKey),
    operation: 'invite_clinic_user',
    userType: 'clinic',
  })
  const redirectTo = `${getClinicDashboardOrigin()}/auth/callback?next=/auth/invite/complete`
  const inviteMetadata = {
    first_name: userMetadata?.firstName ?? '',
    last_name: userMetadata?.lastName ?? '',
    onboarding_key: normalizedOnboardingKey,
  }

  let invitedUser: User | null = null
  let inviteError: unknown = null

  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: inviteMetadata,
      redirectTo,
    })
    inviteError = error
    invitedUser = data.user
  } catch (error) {
    inviteError = error
  }

  const user = invitedUser ?? (await findClinicSupabaseUser(supabase, normalizedEmail, normalizedOnboardingKey))

  if (!user) {
    const message = inviteError ? toSupabaseErrorMessage(inviteError) : 'invite returned no user payload'
    await logProvisionError(logger, 'Failed to invite or reconcile Supabase clinic user', inviteError ?? message, {
      emailHash: hashLogValue(normalizedEmail),
      event: 'auth.supabase.admin.clinic_invite_failed',
      onboardingKeyHash: hashLogValue(normalizedOnboardingKey),
      userType: 'clinic',
    })
    throw new Error(`Supabase clinic invite failed: ${message}`)
  }

  await repairClinicSupabaseUser({
    firstName: userMetadata?.firstName,
    lastName: userMetadata?.lastName,
    onboardingKey: normalizedOnboardingKey,
    supabase,
    user,
  })

  activeLogger.info(
    {
      emailHash: hashLogValue(normalizedEmail),
      event: invitedUser
        ? 'auth.supabase.admin.clinic_invite_succeeded'
        : 'auth.supabase.admin.clinic_invite_reconciled',
      onboardingKeyHash: hashLogValue(normalizedOnboardingKey),
      supabaseUserId: user.id,
      userType: 'clinic',
    },
    invitedUser ? 'Invited Supabase clinic user' : 'Reconciled Supabase clinic user',
  )

  return user.id
}

/** Synchronizes clinic account metadata and its ban state with the current Payload status. */
export async function setClinicSupabaseAccountAccess(
  { enabled, supabaseUserId }: ClinicAccountAccessArgs,
  logger?: ServerLogger,
): Promise<void> {
  const { activeLogger, supabase } = await getProvisionAdminClient(logger, {
    operation: enabled ? 'enable_clinic_user' : 'disable_clinic_user',
    supabaseUserId,
    userType: 'clinic',
  })
  const { error } = await supabase.auth.admin.updateUserById(supabaseUserId, {
    app_metadata: { user_type: 'clinic' },
    ban_duration: enabled ? 'none' : '876000h',
  })

  if (error) {
    throw new Error(`Supabase clinic account access update failed: ${error.message}`)
  }

  activeLogger.info(
    {
      enabled,
      event: 'auth.supabase.admin.clinic_access_updated',
      supabaseUserId,
      userType: 'clinic',
    },
    'Updated Supabase clinic account access',
  )
}

const isMissingSupabaseUserError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { code?: unknown; message?: unknown; status?: unknown }
  return (
    candidate.status === 404 ||
    candidate.code === 'user_not_found' ||
    (typeof candidate.message === 'string' && /user.*not found/i.test(candidate.message))
  )
}

/** Permanently deletes a clinic identity; an already missing identity counts as complete. */
export async function deleteClinicSupabaseAccount(supabaseUserId: string, logger?: ServerLogger): Promise<void> {
  const { activeLogger, supabase } = await getProvisionAdminClient(logger, {
    operation: 'delete_clinic_user',
    supabaseUserId,
    userType: 'clinic',
  })
  const { error } = await supabase.auth.admin.deleteUser(supabaseUserId)

  if (error && !isMissingSupabaseUserError(error)) {
    throw new Error(`Supabase clinic account deletion failed: ${error.message}`)
  }

  activeLogger.info(
    {
      alreadyMissing: Boolean(error),
      event: 'auth.supabase.admin.clinic_user_deleted',
      supabaseUserId,
      userType: 'clinic',
    },
    'Deleted Supabase clinic user',
  )
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
