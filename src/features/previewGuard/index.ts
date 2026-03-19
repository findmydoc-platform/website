import type { User } from '@supabase/supabase-js'
import { resolveRuntimeClass, resolveServerRuntimeEnvironment, RUNTIME_POLICY } from '@/features/runtimePolicy'

export const PREVIEW_GUARD_LOCK_REQUEST_HEADER = 'x-preview-guard-lock'
export const PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY = 'preview-login-required'
export const PREVIEW_GUARD_LOGIN_PATH = '/admin/login'
export const PREVIEW_GUARD_FALLBACK_REDIRECT = '/admin'

const PREVIEW_GUARD_EXEMPT_PATHS = new Set([PREVIEW_GUARD_LOGIN_PATH, '/admin/first-admin'])

type DeploymentEnvInput = Pick<NodeJS.ProcessEnv, 'DEPLOYMENT_ENV' | 'NODE_ENV' | 'VERCEL_ENV'>
type UserTypeCarrier = Pick<User, 'app_metadata'> | null

const normalizePathname = (pathname: string): string => {
  if (!pathname) return '/'
  if (pathname === '/') return pathname

  const prefixed = pathname.startsWith('/') ? pathname : `/${pathname}`
  return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed
}

export const resolveDeploymentEnvironment = (env: DeploymentEnvInput = process.env): string => {
  return resolveServerRuntimeEnvironment(env)
}

export const isPreviewDeployment = (env: DeploymentEnvInput = process.env): boolean =>
  resolveRuntimeClass(env) === 'preview'

export const isNonProductionDeployment = (env: DeploymentEnvInput = process.env): boolean =>
  resolveDeploymentEnvironment(env) !== 'production'

export const isPreviewGuardEnabled = (env: DeploymentEnvInput = process.env): boolean => {
  const runtimeClass = resolveRuntimeClass(env)
  return RUNTIME_POLICY[runtimeClass].auth.enablePreviewGuard
}

export const isPreviewGuardExemptPath = (pathname: string): boolean =>
  PREVIEW_GUARD_EXEMPT_PATHS.has(normalizePathname(pathname))

export const isAllowedPreviewUser = (user: UserTypeCarrier): boolean => {
  const userType = user?.app_metadata?.user_type
  return typeof userType === 'string' && userType.trim().toLowerCase() === 'platform'
}

export const buildPreviewGuardLoginRedirect = (url: URL): string => {
  const nextPath = `${url.pathname}${url.search || ''}` || '/'
  const params = new URLSearchParams({
    message: PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY,
    next: nextPath,
  })

  return `${PREVIEW_GUARD_LOGIN_PATH}?${params.toString()}`
}

export const sanitizePreviewGuardNextPath = (nextPath: string | null | undefined): string => {
  if (!nextPath) return PREVIEW_GUARD_FALLBACK_REDIRECT

  const trimmed = nextPath.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return PREVIEW_GUARD_FALLBACK_REDIRECT
  if (trimmed.includes('\r') || trimmed.includes('\n')) return PREVIEW_GUARD_FALLBACK_REDIRECT

  try {
    const parsed = new URL(trimmed, 'http://localhost')
    if (parsed.origin !== 'http://localhost') return PREVIEW_GUARD_FALLBACK_REDIRECT

    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`
    if (safePath.startsWith(PREVIEW_GUARD_LOGIN_PATH)) return PREVIEW_GUARD_FALLBACK_REDIRECT
    return safePath
  } catch {
    return PREVIEW_GUARD_FALLBACK_REDIRECT
  }
}
