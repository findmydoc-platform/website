export const TEMPORARY_LANDING_MODE_REQUEST_HEADER = 'x-temporary-landing-mode'

const TEMPORARY_LANDING_PUBLIC_EXEMPT_PATHS = new Set(['/privacy-policy', '/imprint', '/contact'])
const TEMPORARY_LANDING_EXEMPT_PATHS = new Set(['/admin', ...TEMPORARY_LANDING_PUBLIC_EXEMPT_PATHS])
const TEMPORARY_LANDING_EXEMPT_PREFIXES = new Set(['/admin', '/auth', '/login', '/logout', '/register'])

const normalizePathname = (pathname: string): string => {
  if (!pathname) return '/'
  if (pathname === '/') return pathname

  const prefixed = pathname.startsWith('/') ? pathname : `/${pathname}`
  return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed
}

export const isTemporaryLandingModeRequest = (headers: Headers): boolean => {
  return headers.get(TEMPORARY_LANDING_MODE_REQUEST_HEADER) === '1'
}

export const isTemporaryLandingModeExemptPath = (pathname: string): boolean => {
  const normalizedPath = normalizePathname(pathname)
  for (const prefix of TEMPORARY_LANDING_EXEMPT_PREFIXES) {
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
      return true
    }
  }

  return TEMPORARY_LANDING_EXEMPT_PATHS.has(normalizedPath)
}

export const isTemporaryLandingPublicExemptPath = (pathname: string): boolean => {
  return TEMPORARY_LANDING_PUBLIC_EXEMPT_PATHS.has(normalizePathname(pathname))
}

export const isTemporaryLandingRootPath = (pathname: string): boolean => {
  return normalizePathname(pathname) === '/'
}

export * from './content'
export * from './i18n'
