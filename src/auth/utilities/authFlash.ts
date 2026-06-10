export const AUTH_FLASH_STORAGE_KEY = 'findmydoc.auth.flash'

const AUTH_FLASH_TTL_MS = 5 * 60 * 1000

export type AuthFlashKind = 'password-reset-complete'

export type AuthFlashPayload = {
  kind: AuthFlashKind
  expiresAt: number
}

const authFlashMessages: Record<AuthFlashKind, string> = {
  'password-reset-complete': 'Password updated successfully. Sign in with your new password.',
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isAuthFlashKind = (value: unknown): value is AuthFlashKind => value === 'password-reset-complete'

const isAuthFlashPayload = (value: unknown): value is AuthFlashPayload =>
  isRecord(value) &&
  isAuthFlashKind(value.kind) &&
  typeof value.expiresAt === 'number' &&
  Number.isFinite(value.expiresAt)

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function createPasswordResetCompleteFlash(now = Date.now()): AuthFlashPayload {
  return {
    expiresAt: now + AUTH_FLASH_TTL_MS,
    kind: 'password-reset-complete',
  }
}

export function writeAuthFlash(payload: AuthFlashPayload): void {
  const storage = getSessionStorage()
  if (!storage) return

  try {
    storage.setItem(AUTH_FLASH_STORAGE_KEY, JSON.stringify(payload))
  } catch {}
}

export function consumeAuthFlash(now = Date.now()): AuthFlashPayload | null {
  const storage = getSessionStorage()
  if (!storage) return null

  const rawPayload = storage.getItem(AUTH_FLASH_STORAGE_KEY)
  if (!rawPayload) return null

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(rawPayload)
  } catch {
    storage.removeItem(AUTH_FLASH_STORAGE_KEY)
    return null
  }

  if (!isAuthFlashPayload(parsedPayload)) {
    storage.removeItem(AUTH_FLASH_STORAGE_KEY)
    return null
  }

  if (parsedPayload.expiresAt <= now) {
    storage.removeItem(AUTH_FLASH_STORAGE_KEY)
    return null
  }

  storage.removeItem(AUTH_FLASH_STORAGE_KEY)
  return parsedPayload
}

export function getAuthFlashMessage(payload: AuthFlashPayload): string {
  return authFlashMessages[payload.kind]
}
