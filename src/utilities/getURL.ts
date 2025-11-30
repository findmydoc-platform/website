import canUseDOM from './canUseDOM'

/**
 * Gets the server-side URL for the application.
 * Checks environment variables in order of preference and provides fallback.
 *
 * @returns Server-side URL string
 *
 * Priority order:
 * 1. NEXT_PUBLIC_SERVER_URL
 * 2. https://${VERCEL_PROJECT_PRODUCTION_URL}
 * 3. http://localhost:3000 (fallback)
 */
export const getServerSideURL = () => {
  let url = process.env.NEXT_PUBLIC_SERVER_URL

  if (!url && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  if (!url) {
    url = 'http://localhost:3000'
  }

  return url
}

/**
 * Gets the client-side URL for the application.
 * Uses window.location when available (client-side), otherwise falls back to environment variables.
 *
 * @returns Client-side URL string
 *
 * Priority order:
 * 1. window.location (when in browser)
 * 2. https://${VERCEL_PROJECT_PRODUCTION_URL}
 * 3. NEXT_PUBLIC_SERVER_URL
 * 4. Empty string (fallback)
 */
export const getClientSideURL = () => {
  if (canUseDOM()) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ''}`
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  return process.env.NEXT_PUBLIC_SERVER_URL || ''
}
