import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger, toLoggedError } from '@/utilities/logging/shared'

export function register() {
  // Placeholder for initialization logic if needed
}

export const onRequestError = async (err: unknown, request: unknown, _context: unknown) => {
  const logger = createScopedLogger(fallbackConsoleLogger, {
    component: 'instrumentation',
    scope: 'telemetry.posthog',
  })

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { sendRequestErrorToPostHog } = await import('./posthog/telemetry')
      await sendRequestErrorToPostHog(err, request)
    } catch (telemetryErr) {
      logger.warn(
        {
          err: toLoggedError(telemetryErr),
          event: 'telemetry.posthog.request_error_send_failed',
        },
        'PostHog telemetry failed; continuing',
      )
    }
  }
}
