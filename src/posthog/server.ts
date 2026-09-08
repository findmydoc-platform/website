import { PostHog } from 'posthog-node'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger, toLoggedError } from '@/utilities/logging/shared'
import { resolvePostHogDeploymentMetadata } from './deployment-metadata'
import { sanitizeExceptionProperties } from './exception-context'
import { createPostHogFlagDefinitionCacheProvider } from './flag-definition-cache'

let posthogServerClient: PostHog | null = null
let posthogFeatureFlagClient: PostHog | null = null
let posthogFeatureFlagShutdownTimer: ReturnType<typeof setTimeout> | null = null

export const POSTHOG_FEATURE_FLAGS_POLLING_INTERVAL_MS = 120_000
export const POSTHOG_FEATURE_FLAGS_IDLE_SHUTDOWN_MS = POSTHOG_FEATURE_FLAGS_POLLING_INTERVAL_MS + 30_000
const POSTHOG_EXCEPTION_SEND_TIMEOUT_MS = 1_500

const logger = createScopedLogger(fallbackConsoleLogger, {
  component: 'posthog-server',
  scope: 'telemetry.posthog',
})

const POSTHOG_SERVER_EXCEPTION_APPLICATION = 'website'
const POSTHOG_SERVER_EXCEPTION_DISTINCT_ID = 'server:website'

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

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`PostHog exception send exceeded ${timeoutMs}ms`)), timeoutMs)
    timeout.unref?.()

    promise.then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })

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
    timestamp?: string
    properties?: Record<string, boolean | number | string | null>
  },
): Promise<void> {
  try {
    const { distinctId: _callerDistinctId, properties, ...contextProperties } = props ?? {}
    const payload = {
      ...sanitizeExceptionProperties({ ...contextProperties, ...properties }),
      application: POSTHOG_SERVER_EXCEPTION_APPLICATION,
      error: err instanceof Error ? err.message : String(err),
    }
    const deploymentMetadata = resolvePostHogDeploymentMetadata()

    if (deploymentMetadata.kind === 'local') {
      const { error: _error, ...localPayload } = payload
      logger.error(
        {
          ...localPayload,
          distinctId: POSTHOG_SERVER_EXCEPTION_DISTINCT_ID,
          err: toLoggedError(err),
          event: 'telemetry.posthog.exception_local',
          posthog_event: '$exception',
        },
        'Captured server exception locally without PostHog',
      )
      return
    }

    if (deploymentMetadata.kind === 'invalid') {
      logger.error(
        {
          err: toLoggedError(err),
          event: 'telemetry.posthog.exception_skipped_invalid_deployment_metadata',
          reason: deploymentMetadata.reason,
        },
        'PostHog exception skipped because deployment metadata is invalid',
      )
      return
    }

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

    const additionalProperties = {
      ...payload,
      ...deploymentMetadata.metadata,
    }

    if (!client) return

    await withTimeout(
      (async () => {
        // Prefer captureException if available, else fallback to generic capture
        if (hasCaptureException(client)) {
          await client.captureException(err, POSTHOG_SERVER_EXCEPTION_DISTINCT_ID, additionalProperties)
        } else if (typeof client.capture === 'function') {
          await client.capture({
            distinctId: POSTHOG_SERVER_EXCEPTION_DISTINCT_ID,
            event: 'exception',
            properties: additionalProperties,
          })
        }

        await client.flush()
      })(),
      POSTHOG_EXCEPTION_SEND_TIMEOUT_MS,
    )
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
