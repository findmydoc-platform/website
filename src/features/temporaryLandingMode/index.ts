export const TEMPORARY_LANDING_MODE_ENABLED_ENV_KEY = 'TEMPORARY_LANDING_MODE_ENABLED'
export const TEMPORARY_LANDING_MODE_REQUEST_HEADER = 'x-temporary-landing-mode'

const TEMPORARY_LANDING_TRUE_VALUES = new Set(['1', 'on', 'true', 'yes'])
const TEMPORARY_LANDING_EXEMPT_PATHS = new Set([
  '/admin',
  '/admin/login',
  '/admin/first-admin',
  '/privacy-policy',
  '/imprint',
  '/contact',
])

type TemporaryLandingEnvInput = NodeJS.ProcessEnv | { TEMPORARY_LANDING_MODE_ENABLED?: string }

const normalizePathname = (pathname: string): string => {
  if (!pathname) return '/'
  if (pathname === '/') return pathname

  const prefixed = pathname.startsWith('/') ? pathname : `/${pathname}`
  return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed
}

export const isTemporaryLandingModeEnabled = (env: TemporaryLandingEnvInput = process.env): boolean => {
  const rawValue = env.TEMPORARY_LANDING_MODE_ENABLED
  if (!rawValue) return false

  return TEMPORARY_LANDING_TRUE_VALUES.has(rawValue.trim().toLowerCase())
}

export const isTemporaryLandingModeRequest = (headers: Headers): boolean => {
  return headers.get(TEMPORARY_LANDING_MODE_REQUEST_HEADER) === '1'
}

export const isTemporaryLandingModeExemptPath = (pathname: string): boolean => {
  const normalizedPath = normalizePathname(pathname)
  if (normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')) return true

  return TEMPORARY_LANDING_EXEMPT_PATHS.has(normalizedPath)
}

export const isTemporaryLandingRootPath = (pathname: string): boolean => {
  return normalizePathname(pathname) === '/'
}

export * from './content'
export * from './i18n'
