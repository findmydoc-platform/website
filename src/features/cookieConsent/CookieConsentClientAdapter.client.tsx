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

import { readCookieConsentFromDocument, writeCookieConsentToDocument } from './cookie'
import { useCookieConsentLauncherSlot } from './CookieConsentLauncherSlot.client'

export function CookieConsentClientAdapter(
  props: Omit<
    CookieConsentManagerProps,
    'onAnalyticsConsentChange' | 'onPersistConsent' | 'readConsent' | 'launcherContainer' | 'onInitialPromptClose'
  >,
) {
  const pathname = usePathname()
  const launcherSlot = useCookieConsentLauncherSlot()
  const legalHrefs = [props.config?.privacyPolicyHref, props.config?.imprintLink?.href]
  const deferInitialPrompt = legalHrefs.some((href) => {
    if (!href?.startsWith('/') || href.startsWith('//')) return false
    const legalPath = new URL(href, 'http://localhost:3000').pathname.replace(/\/+$/, '') || '/'
    return legalPath === (pathname?.replace(/\/+$/, '') || '/')
  })
  const sdkReady = usePostHogAnalyticsReady()
  const [diagnostics, setDiagnostics] = useState({
    cookieValid: false,
    analyticsAllowed: false,
    sdkReady: false,
    sessionAvailable: false,
    reason: 'consent_uninitialized',
  })
  const version = props.config?.consentVersion
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
