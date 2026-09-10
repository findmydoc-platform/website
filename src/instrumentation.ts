import type { Instrumentation } from 'next'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger, toLoggedError } from '@/utilities/logging/shared'

export function register() {
  // Placeholder for initialization logic if needed
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const logger = createScopedLogger(fallbackConsoleLogger, {
    component: 'instrumentation',
    scope: 'telemetry.posthog',
  })

  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { sendPostHogRequestError } = await import('./posthog/api')
    await sendPostHogRequestError(err, {
      method: request.method,
      route: context.routePath,
    })
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
