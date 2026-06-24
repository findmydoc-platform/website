import type { Payload } from 'payload'
import type { User } from '@supabase/supabase-js'
import { getLoggedSupabaseAdminClient, getSupabaseLogger } from './supabaseLogger'
import { hashLogValue, toLoggedError } from '@/utilities/logging/shared'
import { isPreviewRuntime } from '@/features/runtimePolicy'

type PayloadForAdminCheck = Pick<Payload, 'find'>
type PayloadAdminCandidate = {
  id: number | string
  supabaseUserId?: string | null
}
type PlatformStaffCandidate = {
  role?: string | null
  user?: number | string | { id?: number | string | null } | null
}
type LocalPlatformStaffUserCheckFailureReason =
  | 'payload_check_failed'
  | 'supabase_admin_client_failed'
  | 'supabase_user_validation_failed'

export type LocalPlatformStaffUserState =
  | { hasPlatformAdmin: boolean; status: 'has_platform_staff' }
  | { status: 'no_platform_staff' }
  | { hasPlatformAdmin: boolean; status: 'no_login_capable_platform_staff' }
  | { reason: LocalPlatformStaffUserCheckFailureReason; status: 'check_failed' }
type SupabaseUserByIdResponse = {
  data?: {
    user?: User | null
  }
  error?: unknown
}
type PayloadPlatformStaffLookup = {
  hasPlatformAdmin: boolean
  users: PayloadAdminCandidate[]
}
type LocalPlatformStaffUserStateOptions = {
  validateSupabaseUsers?: boolean
}

const isTruthy = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const toRelationshipId = (value: unknown): number | string | null => {
  if (typeof value === 'number' || typeof value === 'string') {
    return value
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const id = (value as { id?: unknown }).id
  return typeof id === 'number' || typeof id === 'string' ? id : null
}

const isMissingSupabaseUserError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const err = error as { code?: string; message?: string; status?: number }
  const normalizedMessage = err.message?.toLowerCase() ?? ''

  return (
    err.code === 'user_not_found' ||
    err.status === 404 ||
    normalizedMessage.includes('not found') ||
    normalizedMessage.includes('user does not exist')
  )
}

const isPlatformSupabaseUser = (user: User | null | undefined): boolean => {
  return user?.app_metadata?.user_type?.trim().toLowerCase() === 'platform'
}

const findPayloadPlatformStaffUsers = async (payload: PayloadForAdminCheck): Promise<PayloadPlatformStaffLookup> => {
  const platformStaffResult = await payload.find({
    collection: 'platformStaff',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const platformStaffProfiles = (platformStaffResult.docs as PlatformStaffCandidate[]) ?? []
  const platformStaffUserIds = Array.from(
    new Set(
      platformStaffProfiles
        .map((profile) => toRelationshipId(profile.user))
        .filter((id): id is number | string => id !== null),
    ),
  )

  if (platformStaffUserIds.length === 0) {
    return { hasPlatformAdmin: false, users: [] }
  }

  const result = await payload.find({
    collection: 'basicUsers',
    where: {
      and: [{ id: { in: platformStaffUserIds } }, { userType: { equals: 'platform' } }],
    },
    limit: platformStaffUserIds.length,
    overrideAccess: true,
  })

  const users = (result.docs as PayloadAdminCandidate[]) ?? []
  const platformUserIds = new Set(users.map((user) => String(user.id)))
  const hasPlatformAdmin = platformStaffProfiles.some((profile) => {
    const userId = toRelationshipId(profile.user)
    return profile.role === 'admin' && userId !== null && platformUserIds.has(String(userId))
  })

  return { hasPlatformAdmin, users }
}

export async function getLocalPlatformStaffUserState(
  payload: PayloadForAdminCheck,
  options: LocalPlatformStaffUserStateOptions = {},
): Promise<LocalPlatformStaffUserState> {
  try {
    const platformStaffLookup = await findPayloadPlatformStaffUsers(payload)

    if (platformStaffLookup.users.length === 0) {
      return { status: 'no_platform_staff' }
    }

    const supabaseUserIds = Array.from(
      new Set(
        platformStaffLookup.users
          .map((user) => user.supabaseUserId)
          .filter((value): value is string => isTruthy(value)),
      ),
    )

    if (supabaseUserIds.length === 0) {
      return {
        hasPlatformAdmin: platformStaffLookup.hasPlatformAdmin,
        status: 'no_login_capable_platform_staff',
      }
    }

    if (!isPreviewRuntime() || options.validateSupabaseUsers !== true) {
      return {
        hasPlatformAdmin: platformStaffLookup.hasPlatformAdmin,
        status: 'has_platform_staff',
      }
    }

    try {
      const { activeLogger, supabase } = await getLoggedSupabaseAdminClient({
        component: 'supabase-admin-users',
        meta: {
          operation: 'validate_login_capable_staff',
          source: 'payload+supabase',
        },
      })

      for (const supabaseUserId of supabaseUserIds) {
        const { data, error } = (await supabase.auth.admin.getUserById(supabaseUserId)) as SupabaseUserByIdResponse

        if (error) {
          if (isMissingSupabaseUserError(error)) {
            continue
          }

          activeLogger.error(
            {
              err: toLoggedError(error),
              event: 'auth.supabase.admin_users.validation_failed',
              supabaseUserIdHash: hashLogValue(supabaseUserId),
            },
            'Failed to validate login-capable platform staff via Supabase',
          )

          return { reason: 'supabase_user_validation_failed', status: 'check_failed' }
        }

        if (isPlatformSupabaseUser(data?.user)) {
          activeLogger.info(
            {
              event: 'auth.supabase.admin_users.checked',
              hasPlatformAdmin: platformStaffLookup.hasPlatformAdmin,
              payloadPlatformUserCount: platformStaffLookup.users.length,
              source: 'payload+supabase',
            },
            'Validated login-capable platform staff',
          )

          return {
            hasPlatformAdmin: platformStaffLookup.hasPlatformAdmin,
            status: 'has_platform_staff',
          }
        }
      }

      activeLogger.info(
        {
          event: 'auth.supabase.admin_users.recovery_unlocked',
          hasPlatformAdmin: platformStaffLookup.hasPlatformAdmin,
          payloadPlatformUserCount: platformStaffLookup.users.length,
        },
        'No login-capable platform staff found for local payload users',
      )

      return {
        hasPlatformAdmin: platformStaffLookup.hasPlatformAdmin,
        status: 'no_login_capable_platform_staff',
      }
    } catch (error) {
      const logger = await getSupabaseLogger({
        bindings: {
          component: 'supabase-admin-users',
        },
      })

      logger.error(
        {
          err: toLoggedError(error),
          event: 'auth.supabase.admin_users.check_failed',
        },
        'Failed to validate local platform users against Supabase',
      )

      return { reason: 'supabase_admin_client_failed', status: 'check_failed' }
    }
  } catch (error) {
    const logger = await getSupabaseLogger({
      bindings: {
        component: 'supabase-admin-users',
      },
    })

    logger.error(
      {
        err: toLoggedError(error),
        event: 'auth.supabase.admin_users.payload_check_failed',
      },
      'Failed to check Payload platform users',
    )

    return { reason: 'payload_check_failed', status: 'check_failed' }
  }
}

export const getLocalAdminUserState = getLocalPlatformStaffUserState
