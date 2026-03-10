import type { Payload } from 'payload'
import { getLoggedSupabaseAdminClient, getSupabaseLogger } from './supabaseLogger'
import { getDeploymentEnv, toLoggedError } from '@/utilities/logging/shared'
import type { User } from '@supabase/supabase-js'

type PayloadForAdminCheck = Pick<Payload, 'find'>
type PayloadAdminCandidate = {
  id: number | string
  email?: string | null
  supabaseUserId?: string | null
}
type SupabaseUserByIdResponse = {
  data?: {
    user?: User | null
  }
  error?: unknown
}

const isTruthy = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const isPreviewOrDevelopment = (env: Partial<NodeJS.ProcessEnv> = process.env): boolean => {
  const deploymentEnv = getDeploymentEnv(env)
  return deploymentEnv === 'preview' || deploymentEnv === 'development'
}

const isRecoveryEnabled = (env: Partial<NodeJS.ProcessEnv> = process.env): boolean => {
  return env.AUTH_ADMIN_RECOVERY_ENABLED === 'true' && isPreviewOrDevelopment(env)
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
  return user?.app_metadata?.user_type === 'platform'
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

/**
 * Check if at least one login-capable platform admin exists.
 * In development/preview with AUTH_ADMIN_RECOVERY_ENABLED=true, a Payload admin
 * counts only when the associated Supabase user is still present.
 * Outside recovery mode, any platform admin in Payload keeps the existing lock behavior.
 */
export async function hasAdminUsers(payload?: PayloadForAdminCheck): Promise<boolean> {
  if (payload) {
    try {
      const existingPlatformUsers = await findPayloadPlatformAdmins(payload)

      if (existingPlatformUsers.length === 0) {
        return false
      }

      if (!isRecoveryEnabled()) {
        return true
      }

      const supabaseUserIds = existingPlatformUsers
        .map((user) => user.supabaseUserId)
        .filter((value): value is string => isTruthy(value))

      if (supabaseUserIds.length === 0) {
        return false
      }

      try {
        const { activeLogger: logger, supabase } = await getLoggedSupabaseAdminClient({
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

            logger.error(
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
            logger.info(
              {
                event: 'auth.supabase.admin_users.checked',
                platformUserCount: existingPlatformUsers.length,
                source: 'payload+supabase',
              },
              'Validated login-capable platform admin',
            )

            return true
          }
        }

        logger.info(
          {
            event: 'auth.supabase.admin_users.recovery_unlocked',
            payloadPlatformUserCount: existingPlatformUsers.length,
          },
          'No login-capable platform admin found in recovery mode',
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
          'Failed to initialize Supabase admin client for admin validation',
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

  try {
    const { activeLogger: logger, supabase } = await getLoggedSupabaseAdminClient({
      component: 'supabase-admin-users',
      meta: {
        operation: 'list_users',
      },
    })

    // Get all users from Supabase Auth
    const { data: usersData, error } = await supabase.auth.admin.listUsers()

    if (error) {
      logger.error(
        {
          err: error,
          event: 'auth.supabase.admin_users.check_failed',
        },
        'Failed to check Supabase admin users',
      )
      return false
    }

    // Filter for users with platform role in app_metadata
    const platformUsers = usersData?.users?.filter((user) => user.app_metadata?.user_type === 'platform') || []

    logger.info(
      {
        event: 'auth.supabase.admin_users.checked',
        source: 'supabase',
        platformUserCount: platformUsers.length,
      },
      'Checked Supabase admin users',
    )

    return platformUsers.length > 0
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
      'Failed to check Supabase admin users',
    )
    return false
  }
}
