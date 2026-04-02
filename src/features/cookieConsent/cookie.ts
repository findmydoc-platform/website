import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_COOKIE_MAX_AGE_SECONDS,
  COOKIE_CONSENT_COOKIE_NAME,
} from './constants'
import { COOKIE_CONSENT_CATEGORY_ORDER } from './categories'
import type { CookieConsentCategoryMap, CookieConsentChoice, CookieConsentState } from './types'

type CookieConsentPayload = {
  choice: CookieConsentChoice
  categories: CookieConsentCategoryMap
  version: number
  decidedAt: string
}

function normalizeCategoryMap(value: unknown): CookieConsentCategoryMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return Object.fromEntries(COOKIE_CONSENT_CATEGORY_ORDER.map((key) => [key, false])) as CookieConsentCategoryMap
  }

  const source = value as Record<string, unknown>

  return Object.fromEntries(
    COOKIE_CONSENT_CATEGORY_ORDER.map((key) => [key, typeof source[key] === 'boolean' ? source[key] : false]),
  ) as CookieConsentCategoryMap
}

function encodeCookieValue(value: CookieConsentPayload): string {
  return encodeURIComponent(JSON.stringify(value))
}

function emitCookieConsentChange(): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT))
}

function decodeCookieValue(value: string): CookieConsentPayload | null {
  try {
    const decoded = decodeURIComponent(value)
    const parsed = JSON.parse(decoded) as Partial<CookieConsentPayload>

    if (
      (parsed.choice !== 'accepted' && parsed.choice !== 'rejected' && parsed.choice !== 'customized') ||
      typeof parsed.version !== 'number' ||
      !Number.isFinite(parsed.version) ||
      typeof parsed.decidedAt !== 'string' ||
      parsed.decidedAt.length === 0
    ) {
      return null
    }

    return {
      choice: parsed.choice,
      categories: normalizeCategoryMap(parsed.categories),
      version: parsed.version,
      decidedAt: parsed.decidedAt,
    }
  } catch {
    return null
  }
}

export function createCookieConsentState(input: {
  choice: CookieConsentChoice
  categories: CookieConsentCategoryMap
  version: number
  decidedAt?: string
}): CookieConsentState {
  return {
    choice: input.choice,
    categories: normalizeCategoryMap(input.categories),
    version: input.version,
    decidedAt: input.decidedAt ?? new Date().toISOString(),
  }
}

export function serializeCookieConsentState(state: CookieConsentState): string {
  return encodeCookieValue(state)
}

export function parseCookieConsentState(
  value: string | null | undefined,
  expectedVersion: number,
): CookieConsentState | null {
  if (!value) return null

  const parsed = decodeCookieValue(value)
  if (!parsed || parsed.version !== expectedVersion) {
    return null
  }

  return parsed
}

export function readCookieConsentFromDocument(expectedVersion: number): CookieConsentState | null {
  if (typeof document === 'undefined') return null

  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`))

  if (!cookie) return null

  const [, ...valueParts] = cookie.split('=')
  return parseCookieConsentState(valueParts.join('=') ?? null, expectedVersion)
}

export function writeCookieConsentToDocument(state: CookieConsentState): void {
  if (typeof document === 'undefined') return

  const secure = window.location.protocol === 'https:' ? 'Secure' : null
  document.cookie = [
    `${COOKIE_CONSENT_COOKIE_NAME}=${serializeCookieConsentState(state)}`,
    `Max-Age=${COOKIE_CONSENT_COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
    secure,
  ]
    .filter(Boolean)
    .join('; ')

  emitCookieConsentChange()
}

export function clearCookieConsentFromDocument(): void {
  if (typeof document === 'undefined') return

  const secure = window.location.protocol === 'https:' ? 'Secure' : null
  document.cookie = [`${COOKIE_CONSENT_COOKIE_NAME}=`, 'Max-Age=0', 'Path=/', 'SameSite=Lax', secure]
    .filter(Boolean)
    .join('; ')

  emitCookieConsentChange()
}
