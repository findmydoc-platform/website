import type { CookieConsent as CookieConsentGlobal } from '@/payload-types'
import { COOKIE_CONSENT_DEFAULT_VERSION } from './constants'
import type { CookieConsentConfig } from './types'

const defaultConfig: CookieConsentConfig = {
  enabled: true,
  consentVersion: COOKIE_CONSENT_DEFAULT_VERSION,
  banner: {
    title: 'Cookies on findmydoc',
    description:
      'We use essential cookies to keep the site working and optional cookies to understand usage and improve the experience.',
    acceptLabel: 'Accept all',
    rejectLabel: 'Reject all',
    customizeLabel: 'Customize',
  },
  settings: {
    title: 'Cookie settings',
    description: 'Choose which optional cookies you allow. Essential cookies are always active.',
    essentialLabel: 'Essential cookies',
    essentialDescription: 'Required for core site functionality, security, and consent persistence.',
    cancelLabel: 'Cancel',
    saveLabel: 'Save preferences',
  },
  categories: [
    {
      key: 'analytics',
      label: 'Analytics cookies',
      description: 'Help us understand how the site is used so we can improve it.',
    },
    {
      key: 'functional',
      label: 'Functional cookies',
      description: 'Remember helpful preferences and support a smoother experience.',
    },
  ],
  privacyPolicyLabel: 'Privacy Policy',
  privacyPolicyHref: '/privacy-policy',
  reopenLabel: 'Cookie settings',
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function normalizeCategory(
  value: unknown,
  fallback: CookieConsentConfig['categories'][number],
): CookieConsentConfig['categories'][number] {
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const raw = value as {
    key?: unknown
    label?: unknown
    description?: unknown
  }

  const key = normalizeText(raw.key, fallback.key)
  const label = normalizeText(raw.label, fallback.label)
  const description = normalizeText(raw.description, fallback.description)

  return {
    key,
    label,
    description,
  }
}

function normalizeCategories(
  value: unknown,
  fallback: CookieConsentConfig['categories'],
): CookieConsentConfig['categories'] {
  if (!Array.isArray(value)) {
    return fallback
  }

  if (value.length === 0) {
    return []
  }

  const normalized = fallback.map((entry) => ({ ...entry }))

  value.slice(0, 4).forEach((entry, index) => {
    const fallbackCategory = (fallback[index] ??
      fallback[fallback.length - 1] ??
      fallback[0]) as CookieConsentConfig['categories'][number]

    if (normalized[index]) {
      normalized[index] = normalizeCategory(entry, fallbackCategory)
      return
    }

    normalized.push(normalizeCategory(entry, fallbackCategory))
  })

  return normalized.slice(0, 4)
}

function normalizeHref(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }

  if (value && typeof value === 'object') {
    const slug = (value as { slug?: unknown }).slug
    if (typeof slug === 'string' && slug.trim().length > 0) {
      return `/${slug.replace(/^\/+/, '')}`
    }
  }

  return fallback
}

export function normalizeCookieConsentGlobal(
  global: (CookieConsentGlobal & { privacyPolicyPage?: unknown; optionalCategories?: unknown }) | null | undefined,
): CookieConsentConfig | null {
  if (!global) {
    return null
  }

  return {
    enabled: normalizeBoolean(global.enabled, defaultConfig.enabled),
    consentVersion: normalizeNumber(global.consentVersion, defaultConfig.consentVersion),
    banner: {
      title: normalizeText(global.bannerTitle, defaultConfig.banner.title),
      description: normalizeText(global.bannerDescription, defaultConfig.banner.description),
      acceptLabel: normalizeText(global.acceptLabel, defaultConfig.banner.acceptLabel),
      rejectLabel: normalizeText(global.rejectLabel, defaultConfig.banner.rejectLabel),
      customizeLabel: normalizeText(global.customizeLabel, defaultConfig.banner.customizeLabel),
    },
    settings: {
      title: normalizeText(global.settingsTitle, defaultConfig.settings.title),
      description: normalizeText(global.settingsDescription, defaultConfig.settings.description),
      essentialLabel: normalizeText(global.essentialLabel, defaultConfig.settings.essentialLabel),
      essentialDescription: normalizeText(global.essentialDescription, defaultConfig.settings.essentialDescription),
      cancelLabel: normalizeText(global.cancelLabel, defaultConfig.settings.cancelLabel),
      saveLabel: normalizeText(global.saveLabel, defaultConfig.settings.saveLabel),
    },
    categories: normalizeCategories(global.optionalCategories, defaultConfig.categories),
    privacyPolicyLabel: normalizeText(global.privacyPolicyLabel, defaultConfig.privacyPolicyLabel),
    privacyPolicyHref: normalizeHref(
      global.privacyPolicyPage,
      normalizeText(global.privacyPolicyUrl, defaultConfig.privacyPolicyHref),
    ),
    reopenLabel: normalizeText(global.reopenLabel, defaultConfig.reopenLabel),
  }
}

export const DEFAULT_COOKIE_CONSENT_CONFIG = defaultConfig
