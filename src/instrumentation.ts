export function register() {
  // Add any initialization logic here if needed
}

export const onRequestError = async (err: any, request: any, _context: any) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getPostHogServer } = require('./posthog/server')
    const posthog = await getPostHogServer()

    let distinctId = null

    // Try to extract user ID from PostHog cookie
    if (request.headers.cookie) {
      const cookieString = request.headers.cookie
      const postHogCookieMatch = cookieString.match(/ph_phc_.*?_posthog=([^;]+)/)

      if (postHogCookieMatch && postHogCookieMatch[1]) {
        try {
          const decodedCookie = decodeURIComponent(postHogCookieMatch[1])
          const postHogData = JSON.parse(decodedCookie)
          distinctId = postHogData.distinct_id
        } catch (e) {
          console.error('Error parsing PostHog cookie:', e)
        }
      }
    }

    // Capture the exception with PostHog
    posthog.captureException(err, {
      distinctId: distinctId || undefined,
      url: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    })

    // Ensure the event is sent before continuing
    await posthog.flush()
  }
}
