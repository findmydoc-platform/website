import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog client for error tracking and analytics
 * Used in server-side contexts like API routes and error handlers
 */
let posthogServerClient: PostHog | null = null

export function getPostHogServer(): PostHog {
  if (!posthogServerClient) {
    posthogServerClient = new PostHog(
      process.env.NEXT_PUBLIC_POSTHOG_KEY!,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        // For server-side in Next.js, flush immediately to avoid losing events
        flushAt: 1,
        flushInterval: 0,
      }
    )
  }
  
  return posthogServerClient
}

/**
 * Safely shut down PostHog server client
 * Call this after server-side operations to ensure events are sent
 */
export async function shutdownPostHogServer(): Promise<void> {
  if (posthogServerClient) {
    await posthogServerClient.shutdown()
  }
}
