import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog client for error tracking and analytics
 * Used in server-side contexts like API routes and error handlers
 */
let posthogServerClient: PostHog | null = null

type PostHogClientWithCaptureException = PostHog & {
  captureException: (err: unknown, properties?: Record<string, unknown>) => unknown
}

const hasCaptureException = (client: PostHog): client is PostHogClientWithCaptureException => {
  const maybe = client as unknown as { captureException?: unknown }
  return typeof maybe.captureException === 'function'
}

export function getPostHogServer(): PostHog {
  if (!posthogServerClient) {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!posthogKey) {
      throw new Error('Environment variable NEXT_PUBLIC_POSTHOG_KEY is not set.')
    }

    if (!posthogHost) {
      throw new Error('Environment variable NEXT_PUBLIC_POSTHOG_HOST is not set.')
    }

    posthogServerClient = new PostHog(posthogKey, {
      host: posthogHost,
      // For server-side in Next.js, flush immediately to avoid losing events
      flushAt: 1,
      flushInterval: 0,
    })
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

/**
 * Safely send an exception to PostHog if configured.
 * This will never throw if PostHog is not configured or if sending fails.
 */
export async function sendExceptionToPostHog(
  err: unknown,
  props?: {
    distinctId?: string
    url?: string
    method?: string
    userAgent?: string
    timestamp?: string
  },
): Promise<void> {
  try {
    let client: PostHog | null = null
    try {
      client = getPostHogServer()
    } catch (_err) {
      // Missing config or initialization failure; bail quietly
      console.warn('PostHog not configured; skipping sendExceptionToPostHog')
      return
    }

    const payload = {
      error: err instanceof Error ? err.message : String(err),
      ...props,
    }

    if (!client) return

    // Prefer captureException if available, else fallback to generic capture
    if (hasCaptureException(client)) {
      await client.captureException(err, payload)
    } else if (typeof client.capture === 'function') {
      await client.capture({ distinctId: props?.distinctId ?? 'server', event: 'exception', properties: payload })
    }

    // shutdown exists on PostHog, but keep a safe fallback
    if (typeof client.shutdown === 'function') {
      await client.shutdown()
    } else {
      await shutdownPostHogServer().catch(() => undefined)
    }
  } catch (sendErr) {
    // Never allow telemetry failures to bubble up
    console.error('sendExceptionToPostHog failed:', sendErr)
  }
}
