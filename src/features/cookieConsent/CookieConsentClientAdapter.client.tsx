'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import {
  CookieConsentManager,
  type CookieConsentManagerProps,
} from '@/components/organisms/CookieConsent/CookieConsentManager.client'
import {
  getPostHogBrowserDiagnostics,
  setPostHogAnalyticsConsent,
  usePostHogAnalyticsReady,
} from '@/posthog/client-api'

import { temporaryLandingLocaleFromPath } from '@/features/temporaryLandingMode/i18n'
import { AUTH_CONFIRMATION_PATH } from '@/i18n/patientAuthPath'
import { publicPageLocaleFromPath } from '@/i18n/publicNavigationPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { getManagedLegalPageSlugFromPath } from '@/utilities/legalPages'

import type { CookieConsentConfig } from './types'
import { readCookieConsentFromDocument, writeCookieConsentToDocument } from './cookie'
import { useCookieConsentLauncherSlot } from './CookieConsentLauncherSlot.client'

type CookieConsentClientAdapterProps = Pick<CookieConsentManagerProps, 'initialConsent'> & {
  config: CookieConsentConfig | Record<UiCopyLocale, CookieConsentConfig | null> | null
}

export function CookieConsentClientAdapter({ config, ...props }: CookieConsentClientAdapterProps) {
  const pathname = usePathname()
  const launcherSlot = useCookieConsentLauncherSlot()
  const path = pathname?.replace(/\/+$/, '') || '/'
  const locale =
    path === AUTH_CONFIRMATION_PATH
      ? 'de'
      : temporaryLandingLocaleFromPath(path) === 'tr'
        ? 'en'
        : publicPageLocaleFromPath(path)
  const activeConfig = config && 'de' in config ? config[locale] : config
  const deferInitialPrompt = Boolean(
    getManagedLegalPageSlugFromPath(path) ||
    path === activeConfig?.privacyPolicyHref ||
    path === activeConfig?.imprintLink?.href,
  )
  const sdkReady = usePostHogAnalyticsReady()
  const [diagnostics, setDiagnostics] = useState({
    cookieValid: false,
    analyticsAllowed: false,
    sdkReady: false,
    sessionAvailable: false,
    reason: 'consent_uninitialized',
  })
  const version = activeConfig?.consentVersion
  const updateDiagnostics = useCallback(() => {
    let cookieValid = false
    try {
      cookieValid = version !== undefined && readCookieConsentFromDocument(version) !== null
    } catch {
      // The diagnostic never exposes storage errors or cookie contents.
    }
    const sdk = getPostHogBrowserDiagnostics()
    setDiagnostics({ cookieValid, ...sdk, reason: cookieValid ? sdk.reason : 'cookie_invalid' })
  }, [version])
  const handleAnalyticsConsentChange = useCallback(
    (enabled: boolean) => {
      setPostHogAnalyticsConsent(enabled)
      updateDiagnostics()
    },
    [updateDiagnostics],
  )

  useEffect(updateDiagnostics, [updateDiagnostics, sdkReady])

  return (
    <>
      <span hidden data-analytics-diagnostics={JSON.stringify(diagnostics)} />
      <CookieConsentManager
        {...props}
        config={activeConfig}
        deferInitialPrompt={deferInitialPrompt}
        launcherContainer={launcherSlot}
        onInitialPromptClose={() => {
          const heading = launcherSlot?.closest('main')?.querySelector('h1')
          if (!heading) return false
          heading.tabIndex = -1
          heading.focus()
          return document.activeElement === heading
        }}
        onAnalyticsConsentChange={handleAnalyticsConsentChange}
        onPersistConsent={writeCookieConsentToDocument}
        readConsent={readCookieConsentFromDocument}
      />
    </>
  )
}
