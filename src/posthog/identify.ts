import type { AuthData } from '@/auth/types/authTypes'
import { getPostHogServer } from './server'

/**
 * Cache to track users already identified in this server session
 * Prevents redundant PostHog identify calls
 */
const identifiedUsers = new Set<string>()

/**
 * Identify user in PostHog with smart caching to prevent redundant calls
 * @param authData - User authentication data from Supabase
 */
export async function identifyUser(authData: AuthData): Promise<void> {
  // Skip if user already identified in this server session
  if (identifiedUsers.has(authData.supabaseUserId)) {
    return
  }

  try {
    const posthog = getPostHogServer()
    posthog.identify({
      distinctId: authData.supabaseUserId,
      properties: {
        email: authData.userEmail,
        user_type: authData.userType,
        first_name: authData.firstName,
        last_name: authData.lastName,
      },
    })

    // Mark user as identified to prevent future redundant calls
    identifiedUsers.add(authData.supabaseUserId)
  } catch (error) {
    console.warn('Failed to identify user in PostHog:', error)
    // Don't throw - PostHog identification should not break authentication
  }
}

/**
 * Reset the identification cache (useful for testing or server restart scenarios)
 */
export function resetIdentificationCache(): void {
  identifiedUsers.clear()
}
