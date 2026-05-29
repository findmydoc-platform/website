import type { Payload } from 'payload'
import type { User } from '@supabase/supabase-js'
import { getLoggedSupabaseAdminClient, getSupabaseLogger } from './supabaseLogger'
import { toLoggedError } from '@/utilities/logging/shared'
import { resolveRuntimeClass } from '@/features/runtimePolicy'

type PayloadForAdminCheck = Pick<Payload, 'find'>
type PayloadAdminCandidate = {
  id: number | string
  supabaseUserId?: string | null
}
type PlatformStaffAdminCandidate = {
  user?: number | string | { id?: number | string | null } | null
}
type LocalAdminUserCheckFailureReason =
  | 'payload_check_failed'
  | 'supabase_admin_client_failed'
  | 'supabase_user_validation_failed'

export type LocalAdminUserState =
  | { status: 'has_admins' }
  | { status: 'no_admins' }
  | { reason: LocalAdminUserCheckFailureReason; status: 'check_failed' }
type SupabaseUserByIdResponse = {
  data?: {
    user?: User | null
  }
  error?: unknown
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

const isPreviewRuntime = (env: NodeJS.ProcessEnv = process.env): boolean => resolveRuntimeClass(env) === 'preview'

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

const findPayloadPlatformAdmins = async (payload: PayloadForAdminCheck): Promise<PayloadAdminCandidate[]> => {
  const platformStaffAdmins = await payload.find({
    collection: 'platformStaff',
    where: {
      role: { equals: 'admin' },
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const adminUserIds = Array.from(
    new Set(
      ((platformStaffAdmins.docs as PlatformStaffAdminCandidate[]) ?? [])
        .map((profile) => toRelationshipId(profile.user))
        .filter((id): id is number | string => id !== null),
    ),
  )

  if (adminUserIds.length === 0) {
    return []
  }

  const result = await payload.find({
    collection: 'basicUsers',
    where: {
      and: [{ id: { in: adminUserIds } }, { userType: { equals: 'platform' } }],
    },
    limit: adminUserIds.length,
    overrideAccess: true,
  })

  return (result.docs as PayloadAdminCandidate[]) ?? []
}

export async function getLocalAdminUserState(payload: PayloadForAdminCheck): Promise<LocalAdminUserState> {
  try {
    const existingPlatformUsers = await findPayloadPlatformAdmins(payload)

    if (existingPlatformUsers.length === 0) {
      return { status: 'no_admins' }
    }

    if (!isPreviewRuntime()) {
      return { status: 'has_admins' }
    }

    const supabaseUserIds = existingPlatformUsers
      .map((user) => user.supabaseUserId)
      .filter((value): value is string => isTruthy(value))

    if (supabaseUserIds.length === 0) {
      return { status: 'no_admins' }
    }

    try {
      const { activeLogger, supabase } = await getLoggedSupabaseAdminClient({
        component: 'supabase-admin-users',
        meta: {
          operation: 'validate_login_capable_admin',
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
              supabaseUserId,
            },
            'Failed to validate login-capable admin via Supabase',
          )

          return { reason: 'supabase_user_validation_failed', status: 'check_failed' }
        }

        if (isPlatformSupabaseUser(data?.user)) {
          activeLogger.info(
            {
              event: 'auth.supabase.admin_users.checked',
              payloadPlatformUserCount: existingPlatformUsers.length,
              source: 'payload+supabase',
            },
            'Validated login-capable platform admin',
          )

          return { status: 'has_admins' }
        }
      }

      activeLogger.info(
        {
          event: 'auth.supabase.admin_users.recovery_unlocked',
          payloadPlatformUserCount: existingPlatformUsers.length,
        },
        'No login-capable platform admin found for local payload users',
      )

      return { status: 'no_admins' }
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
