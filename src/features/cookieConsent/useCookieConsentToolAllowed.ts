'use client'

import * as React from 'react'

import { COOKIE_CONSENT_CHANGE_EVENT } from './constants'
import { readCookieConsentFromDocument } from './cookie'
import { isCookieConsentToolAllowed, type CookieConsentToolKey } from './toolConsent'
import type { CookieConsentConfig, CookieConsentState } from './types'

function subscribeToCookieConsentChanges(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onStoreChange)
  }
}

export function useCookieConsentToolAllowed(
  tool: CookieConsentToolKey,
  config: CookieConsentConfig | null | undefined,
  initialConsent: CookieConsentState | null | undefined,
): boolean {
  return React.useSyncExternalStore(
    subscribeToCookieConsentChanges,
    () =>
      isCookieConsentToolAllowed(tool, config, readCookieConsentFromDocument(config?.consentVersion ?? 0)?.categories),
    () => isCookieConsentToolAllowed(tool, config, initialConsent?.categories),
  )
}
