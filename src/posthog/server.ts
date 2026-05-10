import { PostHog } from 'posthog-node'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger, toLoggedError } from '@/utilities/logging/shared'
import { createPostHogFlagDefinitionCacheProvider } from './flag-definition-cache'

let posthogServerClient: PostHog | null = null
let posthogFeatureFlagClient: PostHog | null = null
let posthogFeatureFlagShutdownTimer: ReturnType<typeof setTimeout> | null = null

export const POSTHOG_FEATURE_FLAGS_POLLING_INTERVAL_MS = 120_000
export const POSTHOG_FEATURE_FLAGS_IDLE_SHUTDOWN_MS = POSTHOG_FEATURE_FLAGS_POLLING_INTERVAL_MS + 30_000

const logger = createScopedLogger(fallbackConsoleLogger, {
  component: 'posthog-server',
  scope: 'telemetry.posthog',
})

type PostHogClientWithCaptureException = PostHog & {
  captureException: (
    err: unknown,
    distinctId?: string,
    additionalProperties?: Record<string | number, unknown>,
  ) => unknown
}

const hasCaptureException = (client: PostHog): client is PostHogClientWithCaptureException => {
  const maybe = client as unknown as { captureException?: unknown }
  return typeof maybe.captureException === 'function'
}

const createPostHogServerClient = ({ enableFeatureFlags }: { enableFeatureFlags: boolean }): PostHog => {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
  const featureFlagsSecureApiKey = process.env.POSTHOG_FEATURE_FLAGS_SECURE_API_KEY

  if (!posthogKey) {
    throw new Error('Environment variable NEXT_PUBLIC_POSTHOG_KEY is not set.')
  }

  if (!posthogHost) {
    throw new Error('Environment variable NEXT_PUBLIC_POSTHOG_HOST is not set.')
  }

  const shouldEnableFeatureFlags = enableFeatureFlags && Boolean(featureFlagsSecureApiKey)
  const flagDefinitionCacheProvider = shouldEnableFeatureFlags
    ? createPostHogFlagDefinitionCacheProvider({ host: posthogHost, projectKey: posthogKey })
    : undefined

  return new PostHog(posthogKey, {
    host: posthogHost,
    // For server-side in Next.js, flush immediately to avoid losing events.
    flushAt: 1,
    flushInterval: 0,
    ...(shouldEnableFeatureFlags
      ? {
          enableLocalEvaluation: true,
          featureFlagsLogWarnings: false,
          featureFlagsPollingInterval: POSTHOG_FEATURE_FLAGS_POLLING_INTERVAL_MS,
          ...(flagDefinitionCacheProvider ? { flagDefinitionCacheProvider } : {}),
          personalApiKey: featureFlagsSecureApiKey,
          strictLocalEvaluation: true,
        }
      : {}),
  })
}

const clearPostHogFeatureFlagShutdownTimer = (): void => {
  if (posthogFeatureFlagShutdownTimer) {
    clearTimeout(posthogFeatureFlagShutdownTimer)
    posthogFeatureFlagShutdownTimer = null
  }
}

/**
 * Server-side PostHog client for error tracking, identify, and analytics capture.
 */
export function getPostHogServer(): PostHog {
  if (!posthogServerClient) {
    posthogServerClient = createPostHogServerClient({ enableFeatureFlags: false })
  }

  return posthogServerClient
}

/**
 * Server-side PostHog client dedicated to local feature flag evaluation.
 */
export function getPostHogFeatureFlagServer(): PostHog {
  clearPostHogFeatureFlagShutdownTimer()

  if (!posthogFeatureFlagClient) {
    posthogFeatureFlagClient = createPostHogServerClient({ enableFeatureFlags: true })
  }

  return posthogFeatureFlagClient
}

export function isPostHogLocalEvaluationConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_KEY &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST &&
    process.env.POSTHOG_FEATURE_FLAGS_SECURE_API_KEY,
  )
}

export async function shutdownPostHogFeatureFlagServer(): Promise<void> {
  clearPostHogFeatureFlagShutdownTimer()

  if (posthogFeatureFlagClient) {
    const client = posthogFeatureFlagClient
    posthogFeatureFlagClient = null
    await client.shutdown()
  }
}

export function schedulePostHogFeatureFlagServerIdleShutdown(): void {
  clearPostHogFeatureFlagShutdownTimer()

  if (!posthogFeatureFlagClient) return

  posthogFeatureFlagShutdownTimer = setTimeout(() => {
    void shutdownPostHogFeatureFlagServer().catch((error: unknown) => {
      logger.warn(
        {
          err: toLoggedError(error),
          event: 'telemetry.posthog.feature_flags_idle_shutdown_failed',
        },
        'Failed to shut down idle PostHog feature flag client',
      )
    })
  }, POSTHOG_FEATURE_FLAGS_IDLE_SHUTDOWN_MS)

  posthogFeatureFlagShutdownTimer.unref?.()
}

/**
 * Safely shut down PostHog server clients.
 * Call this after server-side operations to ensure events are sent.
 */
export async function shutdownPostHogServer(): Promise<void> {
  if (posthogServerClient) {
    await posthogServerClient.shutdown()
    posthogServerClient = null
  }

  await shutdownPostHogFeatureFlagServer()
}

export function resetPostHogServerForTests(): void {
  clearPostHogFeatureFlagShutdownTimer()
  posthogServerClient = null
  posthogFeatureFlagClient = null
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
      logger.warn(
        {
          event: 'telemetry.posthog.exception_skipped_unconfigured',
        },
        'PostHog not configured; skipping sendExceptionToPostHog',
      )
      return
    }

    const distinctId = props?.distinctId ?? 'server'
    const payload = {
      error: err instanceof Error ? err.message : String(err),
      ...props,
    }
    const { distinctId: _distinctId, ...additionalProperties } = payload

    if (!client) return

    // Prefer captureException if available, else fallback to generic capture
    if (hasCaptureException(client)) {
      await client.captureException(err, distinctId, additionalProperties)
    } else if (typeof client.capture === 'function') {
      await client.capture({ distinctId, event: 'exception', properties: payload })
    }

    await client.flush()
  } catch (sendErr) {
    // Never allow telemetry failures to bubble up
    logger.error(
      {
        err: toLoggedError(sendErr),
        event: 'telemetry.posthog.exception_send_failed',
      },
      'sendExceptionToPostHog failed',
    )
  }
}
