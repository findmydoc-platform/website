import type { User } from '@supabase/supabase-js'

import { VALID_USER_TYPES } from '@/auth/config/authConfig'

export type SupabaseAuthErrorLike = {
  code?: string
  message?: string
  name?: string
  status?: number
}

export const isTemporarySupabaseAuthError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const authError = error as SupabaseAuthErrorLike
  const normalizedMessage = authError.message?.toLowerCase() ?? ''

  return (
    authError.name === 'AuthRetryableFetchError' ||
    authError.status === 0 ||
    authError.status === 429 ||
    (typeof authError.status === 'number' && authError.status >= 500) ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network error') ||
    normalizedMessage.includes('timed out')
  )
}

export function extractTokenFromHeader(headers?: Headers): string | undefined {
  if (!headers) return undefined

  const authHeader = headers.get('authorization') || headers.get('Authorization')
  if (!authHeader) return undefined

  const [scheme, ...rest] = authHeader.trim().split(/\s+/)
  if (scheme?.toLowerCase() !== 'bearer' || rest.length !== 1) return undefined

  return rest[0]
}

export function validateSupabaseUser(user: User | null): boolean {
  if (!user?.id || !user?.email) return false

  const userType = user.app_metadata?.user_type
  return typeof userType === 'string' && VALID_USER_TYPES.some((validUserType) => validUserType === userType)
}
