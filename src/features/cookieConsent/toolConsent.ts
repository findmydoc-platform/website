import type { CookieConsentCategoryKey } from './categories'
import type { CookieConsentCategoryMap, CookieConsentConfig } from './types'

export const COOKIE_CONSENT_TOOL_REGISTRY = {
  posthog: {
    label: 'PostHog',
    description:
      'With permission for this category, PostHog analyses page views, clicks, technical errors and browsing session recordings, and consent-dependent server-side product events. Without permission, this analysis and session recording remain off. The website remains usable.',
    privacyHref: 'https://posthog.com/privacy',
  },
  openstreetmap: {
    label: 'OpenStreetMap',
    description:
      'With permission for this category, OpenStreetMap loads external maps to show clinic locations. Without permission, external maps remain blocked and a placeholder is shown.',
    privacyHref: 'https://osmfoundation.org/wiki/Privacy_Policy',
  },
} as const

export type CookieConsentToolKey = keyof typeof COOKIE_CONSENT_TOOL_REGISTRY

export const COOKIE_CONSENT_TOOL_SELECT_OPTIONS = Object.entries(COOKIE_CONSENT_TOOL_REGISTRY).map(([value, tool]) => ({
  label: tool.label,
  value: value as CookieConsentToolKey,
}))

export function isCookieConsentToolKey(value: unknown): value is CookieConsentToolKey {
  return typeof value === 'string' && value in COOKIE_CONSENT_TOOL_REGISTRY
}

export function normalizeCookieConsentToolKeys(
  value: unknown,
  fallback: readonly CookieConsentToolKey[] = [],
): CookieConsentToolKey[] {
  if (!Array.isArray(value)) {
    return [...new Set(fallback)]
  }

  const seen = new Set<CookieConsentToolKey>()

  return value.flatMap((entry) => {
    if (!isCookieConsentToolKey(entry) || seen.has(entry)) {
      return []
    }

    seen.add(entry)
    return [entry]
  })
}

export function findActiveConsentCategory(
  categories: CookieConsentConfig['categories'] | null | undefined,
  tool: CookieConsentToolKey,
): CookieConsentCategoryKey | null {
  const matches = categories?.filter((category) => category.tools.includes(tool)).map((category) => category.key) ?? []

  if (matches.length !== 1) {
    return null
  }

  return matches[0] ?? null
}

export function isCookieConsentToolAllowed(
  tool: CookieConsentToolKey,
  config: CookieConsentConfig | null | undefined,
  consent: CookieConsentCategoryMap | null | undefined,
): boolean {
  if (!config?.enabled) {
    return false
  }

  const categoryKey = findActiveConsentCategory(config.categories, tool)

  return Boolean(categoryKey && consent?.[categoryKey])
}
