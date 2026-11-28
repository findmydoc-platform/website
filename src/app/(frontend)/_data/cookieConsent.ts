import { getTranslations } from 'next-intl/server'

import { normalizeCookieConsentGlobal, type CookieConsentUiCopy } from '@/features/cookieConsent/normalizeGlobal'
import { COOKIE_CONSENT_TOOL_REGISTRY } from '@/features/cookieConsent/toolConsent'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import type { CookieConsent } from '@/payload-types'
import { getGlobal } from '@/utilities/getGlobals'
import { getManagedLegalPageSlugFromPath } from '@/utilities/legalPages'
import { getHoldingLegalLinks } from './holdingLegalLinks'
import type { HoldingLegalLinks } from '@/features/temporaryLandingMode/navigation'

async function getCookieConsentCopy(locale: UiCopyLocale): Promise<CookieConsentUiCopy> {
  const t = await getTranslations({ locale, namespace: 'cookieConsent' })

  return {
    settings: {
      title: t('settings.title'),
      description: t('settings.description'),
      essentialLabel: t('essential.label'),
      essentialDescription: t('essential.description'),
      cancelLabel: t('settings.cancel'),
      saveLabel: t('settings.save'),
    },
    categories: {
      functional: {
        label: t('category.functional.label'),
        description: t('category.functional.description'),
      },
      analytics: {
        label: t('category.analytics.label'),
        description: t('category.analytics.description'),
      },
      marketing: {
        label: t('category.marketing.label'),
        description: t('category.marketing.description'),
      },
    },
    services: {
      openstreetmap: {
        description: t('service.openstreetmap.description'),
        privacyLabel: t('service.privacyNotice', { service: COOKIE_CONSENT_TOOL_REGISTRY.openstreetmap.label }),
      },
      posthog: {
        description: t('service.posthog.description'),
        privacyLabel: t('service.privacyNotice', { service: COOKIE_CONSENT_TOOL_REGISTRY.posthog.label }),
      },
    },
    noServices: t('category.noServices'),
    serviceScope: t('category.serviceScope'),
    privacyPolicyLabel: t('privacy.label'),
    privacyPolicyDescription: t('privacy.description'),
    imprintLabel: t('imprint.label'),
    reopenLabel: t('settings.reopen'),
    newTabDescription: t('newTab'),
    closeLabel: t('close'),
  }
}

function localizedLegalLabel(label: string, href: string, locale: UiCopyLocale) {
  const destinationLocale = href.startsWith('/en/') ? 'en' : 'de'
  return destinationLocale === locale ? label : `${label} (${destinationLocale.toUpperCase()})`
}

function getLocalizedCookieConsent(
  global: CookieConsent,
  locale: UiCopyLocale,
  copy: CookieConsentUiCopy,
  legalLinks: HoldingLegalLinks,
) {
  const config = normalizeCookieConsentGlobal(global, locale, copy)
  if (!config) return null

  const privacySlug = config.privacyPolicyHref && getManagedLegalPageSlugFromPath(config.privacyPolicyHref)
  const privacyPolicy = privacySlug ? legalLinks[privacySlug] : undefined
  const imprint = legalLinks.imprint
  return {
    ...config,
    privacyPolicyHref: privacyPolicy?.href ?? null,
    privacyPolicyLabel: privacyPolicy
      ? localizedLegalLabel(config.privacyPolicyLabel, privacyPolicy.href, locale)
      : config.privacyPolicyLabel,
    imprintLink: imprint
      ? { href: imprint.href, label: localizedLegalLabel(copy.imprintLabel, imprint.href, locale) }
      : undefined,
  }
}

export async function getCookieConsentConfigs() {
  const [global, german, english, germanLegalLinks, englishLegalLinks] = await Promise.all([
    getGlobal('cookieConsent', 1) as Promise<CookieConsent>,
    getCookieConsentCopy('de'),
    getCookieConsentCopy('en'),
    getHoldingLegalLinks('de'),
    getHoldingLegalLinks('en'),
  ])
  return {
    de: getLocalizedCookieConsent(global, 'de', german, germanLegalLinks),
    en: getLocalizedCookieConsent(global, 'en', english, englishLegalLinks),
  }
}
