import type { CookieConsent as CookieConsentGlobal } from '@/payload-types'
import { REQUIRED_LEGAL_FOOTER_LINKS } from '@/utilities/legalPages'

import { DEFAULT_COOKIE_CONSENT_CATEGORIES, normalizeCookieConsentCategories } from './categories'
import { COOKIE_CONSENT_DEFAULT_VERSION } from './constants'
import type { CookieConsentConfig } from './types'
import { APPROVED_COOKIE_CONSENT_PROMPT } from './promptCopy'
import { COOKIE_CONSENT_TOOL_REGISTRY } from './toolConsent'

const defaultConfig: CookieConsentConfig = {
  enabled: true,
  consentVersion: COOKIE_CONSENT_DEFAULT_VERSION,
  banner: APPROVED_COOKIE_CONSENT_PROMPT.en,
  settings: {
    title: 'Cookie settings',
    description: 'Choose which optional cookies you allow. Essential cookies are always active.',
    essentialLabel: 'Essential cookies',
    essentialDescription: 'Required for core site functionality, security, and consent persistence.',
    cancelLabel: 'Cancel',
    saveLabel: 'Save preferences',
  },
  categories: withServiceDetails(
    DEFAULT_COOKIE_CONSENT_CATEGORIES.map(({ enabled: _enabled, ...category }) => category),
  ),
  privacyPolicyLabel: 'Privacy Policy',
  privacyPolicyHref: '/privacy-policy',
  reopenLabel: 'Cookie settings',
  imprintLink: REQUIRED_LEGAL_FOOTER_LINKS.find((link) => link.href === '/imprint'),
}

function withServiceDetails(categories: CookieConsentConfig['categories']): CookieConsentConfig['categories'] {
  return categories.map((category) => {
    const services = category.tools
      .filter((tool) => categories.filter((entry) => entry.tools.includes(tool)).length === 1)
      .map((tool) => ({
        name: COOKIE_CONSENT_TOOL_REGISTRY[tool].label,
        description: COOKIE_CONSENT_TOOL_REGISTRY[tool].description,
        privacyHref: COOKIE_CONSENT_TOOL_REGISTRY[tool].privacyHref,
      }))
    return {
      ...category,
      description:
        services.length === 0
          ? 'No services are assigned to this category with an active, unambiguous assignment. Selecting it does not enable optional processing.'
          : category.description,
      services,
    }
  })
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

function normalizeCategories(
  value: unknown,
  fallback: CookieConsentConfig['categories'],
): CookieConsentConfig['categories'] {
  const normalizedCategories = normalizeCookieConsentCategories(value, DEFAULT_COOKIE_CONSENT_CATEGORIES)

  return withServiceDetails(
    normalizedCategories
      .filter((category) => category.enabled)
      .map(({ enabled: _enabled, ...category }) => category)
      .slice(0, fallback.length),
  )
}

function normalizePrivacyPolicyHref(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const slug = (value as { slug?: unknown }).slug
    if (typeof slug === 'string' && slug.trim().length > 0) {
      return `/${slug.replace(/^\/+/, '')}`
    }
  }

  return null
}

export function normalizeCookieConsentGlobal(
  global:
    | (CookieConsentGlobal & {
        privacyPolicyPage?: unknown
        optionalCategorySettings?: unknown
        optionalCategories?: unknown
      })
    | null
    | undefined,
): CookieConsentConfig | null {
  if (!global) {
    return null
  }

  const categorySource =
    global.optionalCategorySettings !== undefined ? global.optionalCategorySettings : global.optionalCategories

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
    categories: normalizeCategories(categorySource, defaultConfig.categories),
    privacyPolicyLabel: normalizeText(global.privacyPolicyLabel, defaultConfig.privacyPolicyLabel),
    privacyPolicyHref: normalizePrivacyPolicyHref(global.privacyPolicyPage),
    reopenLabel: normalizeText(global.reopenLabel, defaultConfig.reopenLabel),
    imprintLink: defaultConfig.imprintLink,
  }
}

export const DEFAULT_COOKIE_CONSENT_CONFIG = defaultConfig
