import React from 'react'

import type { CookieConsentConfig, CookieConsentState } from '@/features/cookieConsent'
import { CookieConsentManager } from '@/components/organisms/CookieConsent/CookieConsentManager.client'

export const Providers: React.FC<{
  children: React.ReactNode
  cookieConsentConfig?: CookieConsentConfig | null
  initialCookieConsent?: CookieConsentState | null
}> = ({ children, cookieConsentConfig = null, initialCookieConsent = null }) => {
  return (
    <>
      {children}
      <CookieConsentManager config={cookieConsentConfig} initialConsent={initialCookieConsent} />
    </>
  )
}
