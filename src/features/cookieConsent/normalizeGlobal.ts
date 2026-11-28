import type { UiCopyLocale } from '@/i18n/requestLocale'
import type { CookieConsent as CookieConsentGlobal } from '@/payload-types'
import { REQUIRED_LEGAL_FOOTER_LINKS } from '@/utilities/legalPages'

import { DEFAULT_COOKIE_CONSENT_CATEGORIES, normalizeCookieConsentCategories } from './categories'
import type { CookieConsentCategoryKey } from './categories'
import { COOKIE_CONSENT_DEFAULT_VERSION } from './constants'
import type { CookieConsentConfig } from './types'
import { APPROVED_COOKIE_CONSENT_PROMPT } from './promptCopy'
import { COOKIE_CONSENT_TOOL_REGISTRY, findActiveConsentCategory, type CookieConsentToolKey } from './toolConsent'

export type CookieConsentUiCopy = Pick<
  CookieConsentConfig,
  | 'settings'
  | 'reopenLabel'
  | 'privacyPolicyLabel'
  | 'privacyPolicyDescription'
  | 'newTabDescription'
  | 'serviceScope'
  | 'closeLabel'
> & {
  imprintLabel: string
  categories: Record<CookieConsentCategoryKey, { label: string; description: string }>
  noServices: string
  services: Record<CookieConsentToolKey, { description: string; privacyLabel: string }>
}

const defaultConfig: CookieConsentConfig = {
  locale: 'en',
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
  serviceScope: 'Selecting this category permits all services listed below.',
  newTabDescription: ' (opens in a new tab)',
  closeLabel: 'Close',
  privacyPolicyDescription: 'Read the page that explains how we handle optional cookies and third-party services.',
  privacyPolicyLabel: 'Privacy Policy',
  privacyPolicyHref: '/privacy-policy',
  reopenLabel: 'Cookie settings',
  imprintLink: REQUIRED_LEGAL_FOOTER_LINKS.find((link) => link.href === '/imprint'),
}

function withServiceDetails(
  categories: CookieConsentConfig['categories'],
  copy?: CookieConsentUiCopy,
): CookieConsentConfig['categories'] {
  return categories.map((category) => {
    const services = category.tools
      .filter((tool) => findActiveConsentCategory(categories, tool) === category.key)
      .map((tool) => ({
        name: COOKIE_CONSENT_TOOL_REGISTRY[tool].label,
        description: copy?.services[tool].description ?? COOKIE_CONSENT_TOOL_REGISTRY[tool].description,
        privacyLabel: copy?.services[tool].privacyLabel ?? `${COOKIE_CONSENT_TOOL_REGISTRY[tool].label} privacy notice`,
        privacyHref: COOKIE_CONSENT_TOOL_REGISTRY[tool].privacyHref,
      }))
    return {
      ...category,
      description:
        services.length === 0
          ? (copy?.noServices ??
            'No services are currently available in this category. Selecting it does not enable optional processing.')
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
  useEnglishCmsCopy: boolean,
  copy?: CookieConsentUiCopy,
): CookieConsentConfig['categories'] {
  const fallback = DEFAULT_COOKIE_CONSENT_CATEGORIES.map((category) => ({
    ...category,
    ...copy?.categories[category.key],
  }))
  const normalizedCategories = normalizeCookieConsentCategories(value, fallback)

  return withServiceDetails(
    normalizedCategories
      .filter((category) => category.enabled)
      .map(({ enabled: _enabled, ...category }) => ({
        ...category,
        label: useEnglishCmsCopy ? category.label : (copy?.categories[category.key].label ?? category.label),
      })),
    copy,
  )
}

function normalizePrivacyPolicyHref(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const page = value as { slug?: unknown; legacyEnglishSlug?: unknown }
    const slug = page.legacyEnglishSlug || page.slug
    if (typeof slug === 'string' && slug.trim().length > 0) {
      return `/${slug.replace(/^\/+/, '')}`
    }
  }

  return null
}

type CookieConsentGlobalInput = CookieConsentGlobal & {
  privacyPolicyPage?: unknown
  optionalCategorySettings?: unknown
  optionalCategories?: unknown
}

export function normalizeCookieConsentGlobal(
  global: CookieConsentGlobalInput | null | undefined,
  locale: UiCopyLocale = 'en',
  copy?: CookieConsentUiCopy,
): CookieConsentConfig | null {
  if (!global) {
    return null
  }

  const categorySource =
    global.optionalCategorySettings !== undefined ? global.optionalCategorySettings : global.optionalCategories

  const prompt = locale === 'de' ? global.germanPrompt : global
  const promptFallback = APPROVED_COOKIE_CONSENT_PROMPT[locale]
  const english = locale === 'en' ? global : undefined
  const settings = copy?.settings ?? defaultConfig.settings

  return {
    locale,
    enabled: normalizeBoolean(global.enabled, defaultConfig.enabled),
    consentVersion: normalizeNumber(global.consentVersion, defaultConfig.consentVersion),
    banner: {
      title: normalizeText(prompt?.bannerTitle, promptFallback.title),
      description: normalizeText(prompt?.bannerDescription, promptFallback.description),
      acceptLabel: normalizeText(prompt?.acceptLabel, promptFallback.acceptLabel),
      rejectLabel: normalizeText(prompt?.rejectLabel, promptFallback.rejectLabel),
      customizeLabel: normalizeText(prompt?.customizeLabel, promptFallback.customizeLabel),
    },
    settings: {
      title: normalizeText(english?.settingsTitle, settings.title),
      description: normalizeText(english?.settingsDescription, settings.description),
      essentialLabel: normalizeText(english?.essentialLabel, settings.essentialLabel),
      essentialDescription: normalizeText(english?.essentialDescription, settings.essentialDescription),
      cancelLabel: normalizeText(english?.cancelLabel, settings.cancelLabel),
      saveLabel: normalizeText(english?.saveLabel, settings.saveLabel),
    },
    categories: normalizeCategories(categorySource, locale === 'en', copy),
    serviceScope: copy?.serviceScope ?? defaultConfig.serviceScope,
    newTabDescription: copy?.newTabDescription ?? defaultConfig.newTabDescription,
    closeLabel: copy?.closeLabel ?? defaultConfig.closeLabel,
    privacyPolicyDescription: copy?.privacyPolicyDescription ?? defaultConfig.privacyPolicyDescription,
    privacyPolicyLabel: normalizeText(
      english?.privacyPolicyLabel,
      copy?.privacyPolicyLabel ?? defaultConfig.privacyPolicyLabel,
    ),
    privacyPolicyHref: normalizePrivacyPolicyHref(global.privacyPolicyPage),
    reopenLabel: normalizeText(english?.reopenLabel, copy?.reopenLabel ?? defaultConfig.reopenLabel),
    imprintLink: defaultConfig.imprintLink
      ? { ...defaultConfig.imprintLink, label: copy?.imprintLabel ?? defaultConfig.imprintLink.label }
      : undefined,
  }
}

export const DEFAULT_COOKIE_CONSENT_CONFIG = defaultConfig
