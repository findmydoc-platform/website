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

export function CookieConsentClientAdapter(
  props: Omit<CookieConsentManagerProps, 'onAnalyticsConsentChange' | 'onPersistConsent' | 'readConsent'>,
) {
  const pathname = usePathname()
  const legalHrefs = [props.config?.privacyPolicyHref]
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
        onAnalyticsConsentChange={handleAnalyticsConsentChange}
        onPersistConsent={writeCookieConsentToDocument}
        readConsent={readCookieConsentFromDocument}
      />
    </>
  )
}
