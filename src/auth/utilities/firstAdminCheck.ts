import { getLoggedSupabaseAdminClient, getSupabaseLogger } from './supabaseLogger'
import { toLoggedError } from '@/utilities/logging/shared'

/**
 * Check if any platform staff users exist in Supabase
 * Returns true if at least one platform staff user exists
 */
export async function hasAdminUsers(): Promise<boolean> {
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
