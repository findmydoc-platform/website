export function register() {
  // Placeholder for initialization logic if needed
}

export const onRequestError = async (err: unknown, request: unknown, _context: unknown) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { sendRequestErrorToPostHog } = await import('./posthog/telemetry')
      await sendRequestErrorToPostHog(err, request)
    } catch (telemetryErr) {
      console.warn('PostHog telemetry failed; continuing:', telemetryErr)
    }
  }
}
