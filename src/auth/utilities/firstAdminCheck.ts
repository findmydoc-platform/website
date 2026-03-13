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
type SupabaseUserByIdResponse = {
  data?: {
    user?: User | null
  }
  error?: unknown
}

const isTruthy = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

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
  const result = await payload.find({
    collection: 'basicUsers',
    where: {
      userType: { equals: 'platform' },
    },
    limit: 100,
    overrideAccess: true,
  })

  return (result.docs as PayloadAdminCandidate[]) ?? []
}

export async function hasLocalAdminUsers(payload: PayloadForAdminCheck): Promise<boolean> {
  try {
    const existingPlatformUsers = await findPayloadPlatformAdmins(payload)

    if (existingPlatformUsers.length === 0) {
      return false
    }

    if (!isPreviewRuntime()) {
      return true
    }

    const supabaseUserIds = existingPlatformUsers
      .map((user) => user.supabaseUserId)
      .filter((value): value is string => isTruthy(value))

    if (supabaseUserIds.length === 0) {
      return false
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

          return true
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

          return true
        }
      }

      activeLogger.info(
        {
          event: 'auth.supabase.admin_users.recovery_unlocked',
          payloadPlatformUserCount: existingPlatformUsers.length,
        },
        'No login-capable platform admin found for local payload users',
      )

      return false
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

      return true
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

    return false
  }
}
