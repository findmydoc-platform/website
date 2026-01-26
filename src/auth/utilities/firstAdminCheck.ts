import { createAdminClient } from '@/auth/utilities/supaBaseServer'

/**
 * Check if any platform staff users exist in Supabase
 * Returns true if at least one platform staff user exists
 */
export async function hasAdminUsers(): Promise<boolean> {
  try {
    const supabase = await createAdminClient()

    // Get all users from Supabase Auth
    const { data: usersData, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('Error checking for admin users:', error)
      return false
    }

    // Filter for users with platform role in app_metadata
    const platformUsers = usersData?.users?.filter((user) => user.app_metadata?.user_type === 'platform') || []

    console.info(`Found ${platformUsers.length} admin users in Supabase`)

    return platformUsers.length > 0
  } catch (error) {
    console.error('Error checking for admin users:', error)
    return false
  }
}
