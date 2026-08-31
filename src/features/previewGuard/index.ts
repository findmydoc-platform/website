import type { User } from '@supabase/supabase-js'
import { buildPatientLoginHref } from '@/features/favorites/redirects'
import { isPreviewRuntime, resolveServerRuntimeEnvironment } from '@/features/runtimePolicy'
import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'

export const PREVIEW_GUARD_LOCK_REQUEST_HEADER = 'x-preview-guard-lock'
export const PREVIEW_GUARD_ACTIVE_REQUEST_HEADER = 'x-preview-guard-active'
export const PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY = 'preview-login-required'
export const PREVIEW_GUARD_LOGIN_PATH = '/admin/login'
export const PREVIEW_GUARD_FALLBACK_REDIRECT = '/admin'
export const PREVIEW_GUARD_PATIENT_REGISTRATION_API_PATH = '/api/auth/register/patient'

const PREVIEW_GUARD_ANONYMOUS_API_PATHS = new Set(['/api/auth/callback', '/api/auth/login', '/api/auth/password/reset'])

const PREVIEW_GUARD_EXEMPT_PATHS = new Set([
  PREVIEW_GUARD_LOGIN_PATH,
  '/admin/logout',
  '/auth/callback',
  '/auth/confirm',
  '/auth/invite/complete',
  '/auth/password/reset',
  '/auth/password/reset/complete',
  '/login/patient',
  '/logout',
])

const PREVIEW_GUARD_PLATFORM_PAGE_PATHS = new Set([
  '/',
  '/about',
  '/contact',
  '/listing-comparison',
  '/partners/clinics',
  '/posts',
  '/register/clinic',
  '/register/patient',
])

const PREVIEW_GUARD_RESERVED_PAGE_PREFIXES = new Set([
  '_next',
  'admin',
  'api',
  'auth',
  'clinics',
  'login',
  'logout',
  'next',
  'patient',
  'posts',
  'register',
])

const PREVIEW_GUARD_SCANNER_SEGMENTS = new Set([
  '.git',
  '.hg',
  '.svn',
  'actuator',
  'cgi-bin',
  'phpmyadmin',
  'server-status',
  'wp-admin',
  'wp-content',
  'wp-includes',
])

const PREVIEW_GUARD_SCANNER_API_PATHS = new Set(['/api/exec'])

export type PreviewGuardPagePathClassification = 'dynamic-content' | 'exempt' | 'not-found' | 'patient' | 'platform'

type DeploymentEnvInput = Pick<NodeJS.ProcessEnv, 'DEPLOYMENT_ENV' | 'NODE_ENV' | 'VERCEL_ENV'>
type UserTypeCarrier = Pick<User, 'app_metadata'> | null

const normalizePathname = (pathname: string): string => {
  if (!pathname) return '/'
  if (pathname === '/') return pathname

  const prefixed = pathname.startsWith('/') ? pathname : `/${pathname}`
  return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed
}

const decodePathSegments = (pathname: string): string[] | null => {
  try {
    return pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment).toLowerCase())
  } catch {
    return null
  }
}

export const isPreviewGuardScannerPath = (pathname: string): boolean => {
  const normalizedPath = normalizePathname(pathname).toLowerCase()
  if (PREVIEW_GUARD_SCANNER_API_PATHS.has(normalizedPath)) return true

  const segments = decodePathSegments(pathname)
  if (!segments) return true

  return segments.some((segment) => {
    if (segment === '.env' || segment.startsWith('.env.')) return true
    if (PREVIEW_GUARD_SCANNER_SEGMENTS.has(segment)) return true
    return /\.(?:bak|backup|sql|sql\.gz)$/.test(segment)
  })
}

export const classifyPreviewGuardPagePath = (pathname: string): PreviewGuardPagePathClassification => {
  const normalizedPath = normalizePathname(pathname)

  if (isPreviewGuardExemptPath(normalizedPath)) return 'exempt'
  if (isPreviewGuardScannerPath(normalizedPath)) return 'not-found'
  if (normalizedPath === '/admin/create-first-user' || normalizedPath === '/admin/first-admin') return 'not-found'

  if (
    PREVIEW_GUARD_PLATFORM_PAGE_PATHS.has(normalizedPath) ||
    normalizedPath === '/admin' ||
    normalizedPath.startsWith('/admin/') ||
    /^\/posts\/page\/[1-9]\d*$/.test(normalizedPath)
  ) {
    return 'platform'
  }

  if (
    normalizedPath === '/patient/favorites' ||
    normalizedPath === '/patient/inquiries' ||
    /^\/patient\/inquiries\/[^/]{1,100}$/.test(normalizedPath)
  ) {
    return 'patient'
  }

  if (normalizedPath === '/clinics' || /^\/(?:clinics|posts)\/[^/]+$/.test(normalizedPath)) {
    return 'dynamic-content'
  }

  const segments = decodePathSegments(normalizedPath)
  const firstSegment = segments?.[0]
  if (!firstSegment || PREVIEW_GUARD_RESERVED_PAGE_PREFIXES.has(firstSegment)) return 'not-found'

  return 'dynamic-content'
}

export const resolveDeploymentEnvironment = (env: DeploymentEnvInput = process.env): string => {
  return resolveServerRuntimeEnvironment(env)
}

export const isPreviewDeployment = (env: DeploymentEnvInput = process.env): boolean => isPreviewRuntime(env)

export const isNonProductionDeployment = (env: DeploymentEnvInput = process.env): boolean =>
  resolveDeploymentEnvironment(env) !== 'production'

export const isPreviewGuardExemptPath = (pathname: string): boolean =>
  PREVIEW_GUARD_EXEMPT_PATHS.has(normalizePathname(pathname))

export const isPreviewGuardPatientPath = (pathname: string): boolean =>
  classifyPreviewGuardPagePath(pathname) === 'patient'

export const isPreviewGuardPatientRegistrationApiPath = (pathname: string): boolean =>
  normalizePathname(pathname) === PREVIEW_GUARD_PATIENT_REGISTRATION_API_PATH

export const isPreviewGuardAnonymousApiPath = (pathname: string): boolean =>
  PREVIEW_GUARD_ANONYMOUS_API_PATHS.has(normalizePathname(pathname))

export const isPreviewGuardEndpointAuthApiPath = (pathname: string): boolean => {
  const normalizedPath = normalizePathname(pathname)
  return (
    normalizedPath === '/api/mcp' ||
    normalizedPath === '/api/clinic-dashboard' ||
    normalizedPath.startsWith('/api/clinic-dashboard/')
  )
}

export const isAllowedPreviewUser = (user: UserTypeCarrier): boolean => {
  const userType = user?.app_metadata?.user_type
  return typeof userType === 'string' && userType.trim().toLowerCase() === 'platform'
}

export const isAllowedPreviewPatient = (user: UserTypeCarrier): boolean => {
  const userType = user?.app_metadata?.user_type
  return typeof userType === 'string' && userType.trim().toLowerCase() === 'patient'
}

export const buildPreviewGuardLoginRedirect = (url: URL): string => {
  const nextPath = `${url.pathname}${url.search || ''}` || '/'
  const params = new URLSearchParams({
    message: PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY,
    next: nextPath,
  })

  return `${PREVIEW_GUARD_LOGIN_PATH}?${params.toString()}`
}

export const buildPreviewGuardPatientLoginRedirect = (url: URL): string => {
  const nextPath = `${url.pathname}${url.search || ''}` || '/patient/favorites'
  return buildPatientLoginHref(nextPath)
}

export const sanitizePreviewGuardNextPath = (nextPath: string | null | undefined): string => {
  return sanitizeInternalRedirectPath({
    nextPath,
    fallbackPath: PREVIEW_GUARD_FALLBACK_REDIRECT,
    blockedPaths: [PREVIEW_GUARD_LOGIN_PATH],
  })
}
