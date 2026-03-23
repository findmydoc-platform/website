import canUseDOM from './canUseDOM'

const normalizeEnvValue = (value?: string) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const toHttpsURL = (value?: string) => {
  const normalized = normalizeEnvValue(value)
  if (!normalized) return undefined

  const hostOrUrl = normalized.replace(/^https?:\/\//i, '')
  return `https://${hostOrUrl}`
}

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
  let url = normalizeEnvValue(process.env.NEXT_PUBLIC_SERVER_URL)

  if (!url) {
    const vercelUrl = toHttpsURL(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    if (vercelUrl) return vercelUrl
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
  if (canUseDOM) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ''}`
  }

  const vercelUrl = toHttpsURL(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  if (vercelUrl) {
    return vercelUrl
  }

  return normalizeEnvValue(process.env.NEXT_PUBLIC_SERVER_URL) || ''
}
