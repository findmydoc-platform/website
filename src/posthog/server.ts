import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog client for error tracking and analytics
 * Used in server-side contexts like API routes and error handlers
 */
let posthogServerClient: PostHog | null = null

export function getPostHogServer(): PostHog {
  if (!posthogServerClient) {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!posthogKey) {
      throw new Error("Environment variable NEXT_PUBLIC_POSTHOG_KEY is not set.");
    }

    if (!posthogHost) {
      throw new Error("Environment variable NEXT_PUBLIC_POSTHOG_HOST is not set.");
    }

    posthogServerClient = new PostHog(
      posthogKey,
      {
        host: posthogHost,
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
