'use client'

import {
  CookieConsentManager,
  type CookieConsentManagerProps,
} from '@/components/organisms/CookieConsent/CookieConsentManager.client'
import { setPostHogAnalyticsConsent } from '@/posthog/client-api'

import { writeCookieConsentToDocument } from './cookie'

export function CookieConsentClientAdapter(
  props: Omit<CookieConsentManagerProps, 'onAnalyticsConsentChange' | 'onPersistConsent'>,
) {
  return (
    <CookieConsentManager
      {...props}
      onAnalyticsConsentChange={setPostHogAnalyticsConsent}
      onPersistConsent={writeCookieConsentToDocument}
    />
  )
}
