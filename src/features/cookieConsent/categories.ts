import { normalizeCookieConsentToolKeys, type CookieConsentToolKey } from './toolConsent'

export const COOKIE_CONSENT_CATEGORY_REGISTRY = {
  functional: {
    label: 'Functional cookies',
    description: 'Remember helpful preferences and support a smoother experience.',
    tools: ['openstreetmap'] as const,
  },
  analytics: {
    label: 'Analytics cookies',
    description: 'Help us understand how the site is used so we can improve it.',
    tools: ['posthog'] as const,
  },
  marketing: {
    label: 'Marketing cookies',
    description: 'Support campaign measurement and more relevant marketing communication.',
    tools: [] as const,
  },
} as const

export type CookieConsentCategoryKey = keyof typeof COOKIE_CONSENT_CATEGORY_REGISTRY

export type CookieConsentCategoryEntry = {
  key: CookieConsentCategoryKey
  enabled: boolean
  label: string
  description: string
  tools: CookieConsentToolKey[]
}

export const COOKIE_CONSENT_CATEGORY_ORDER = [
  'functional',
  'analytics',
  'marketing',
] as const satisfies readonly CookieConsentCategoryKey[]

export type CookieConsentCategorySettings = Record<
  CookieConsentCategoryKey,
  {
    enabled: boolean
    label: string
    tools: CookieConsentToolKey[]
  }
>

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function cloneCategory(category: CookieConsentCategoryEntry): CookieConsentCategoryEntry {
  return {
    key: category.key,
    enabled: category.enabled,
    label: category.label,
    description: category.description,
    tools: [...category.tools],
  }
}

function createDefaultCategory(key: CookieConsentCategoryKey): CookieConsentCategoryEntry {
  const category = COOKIE_CONSENT_CATEGORY_REGISTRY[key]

  return {
    key,
    enabled: true,
    label: category.label,
    description: category.description,
    tools: [...category.tools],
  }
}

export const DEFAULT_COOKIE_CONSENT_CATEGORIES = COOKIE_CONSENT_CATEGORY_ORDER.map((key) => createDefaultCategory(key))

type CookieConsentCategoryInput = {
  key?: unknown
  enabled?: unknown
  label?: unknown
  tools?: unknown
}

function normalizeCategory(value: unknown, fallback: CookieConsentCategoryEntry): CookieConsentCategoryEntry {
  if (!value || typeof value !== 'object') {
    return cloneCategory(fallback)
  }

  const raw = value as CookieConsentCategoryInput

  return {
    key: fallback.key,
    enabled: normalizeBoolean(raw.enabled, fallback.enabled),
    label: normalizeText(raw.label, fallback.label),
    description: fallback.description,
    tools: normalizeCookieConsentToolKeys(raw.tools, fallback.tools),
  }
}

function normalizeFromCategorySettingsObject(
  value: unknown,
  fallback: readonly CookieConsentCategoryEntry[],
): CookieConsentCategoryEntry[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>

  return COOKIE_CONSENT_CATEGORY_ORDER.map((key, index) => {
    const fallbackCategory = fallback[index] ?? DEFAULT_COOKIE_CONSENT_CATEGORIES[index] ?? createDefaultCategory(key)
    return normalizeCategory(source[key], fallbackCategory)
  })
}

function normalizeFromLegacyCategoryArray(
  value: unknown,
  fallback: readonly CookieConsentCategoryEntry[],
): CookieConsentCategoryEntry[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const categoriesByKey = new Map<CookieConsentCategoryKey, unknown>()
  const unmatchedEntries: unknown[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      unmatchedEntries.push(entry)
      continue
    }

    const key = (entry as CookieConsentCategoryInput).key
    if (typeof key === 'string' && key in COOKIE_CONSENT_CATEGORY_REGISTRY) {
      categoriesByKey.set(key as CookieConsentCategoryKey, entry)
      continue
    }

    unmatchedEntries.push(entry)
  }

  let unmatchedIndex = 0
  return COOKIE_CONSENT_CATEGORY_ORDER.map((key, index) => {
    const fallbackCategory = fallback[index] ?? DEFAULT_COOKIE_CONSENT_CATEGORIES[index] ?? createDefaultCategory(key)
    const source = categoriesByKey.get(key) ?? unmatchedEntries[unmatchedIndex++]
    return normalizeCategory(source, fallbackCategory)
  })
}

export function normalizeCookieConsentCategories(
  value: unknown,
  fallback: readonly CookieConsentCategoryEntry[] = DEFAULT_COOKIE_CONSENT_CATEGORIES,
): CookieConsentCategoryEntry[] {
  const normalizedFromSettings = normalizeFromCategorySettingsObject(value, fallback)
  if (normalizedFromSettings) {
    return normalizedFromSettings
  }

  const normalizedFromLegacyArray = normalizeFromLegacyCategoryArray(value, fallback)
  if (normalizedFromLegacyArray) {
    return normalizedFromLegacyArray
  }

  return fallback.map((category) => cloneCategory(category))
}

export function toCookieConsentCategorySettings(
  categories: readonly CookieConsentCategoryEntry[],
): CookieConsentCategorySettings {
  return Object.fromEntries(
    COOKIE_CONSENT_CATEGORY_ORDER.map((key, index) => {
      const category = categories[index] ?? DEFAULT_COOKIE_CONSENT_CATEGORIES[index] ?? createDefaultCategory(key)
      return [
        key,
        {
          enabled: category.enabled,
          label: category.label,
          tools: [...category.tools],
        },
      ]
    }),
  ) as CookieConsentCategorySettings
}

export const DEFAULT_COOKIE_CONSENT_CATEGORY_SETTINGS = toCookieConsentCategorySettings(
  DEFAULT_COOKIE_CONSENT_CATEGORIES,
)

export function cloneCookieConsentCategorySettings(
  settings: CookieConsentCategorySettings = DEFAULT_COOKIE_CONSENT_CATEGORY_SETTINGS,
): CookieConsentCategorySettings {
  return Object.fromEntries(
    COOKIE_CONSENT_CATEGORY_ORDER.map((key) => [
      key,
      {
        enabled: settings[key].enabled,
        label: settings[key].label,
        tools: [...settings[key].tools],
      },
    ]),
  ) as CookieConsentCategorySettings
}
