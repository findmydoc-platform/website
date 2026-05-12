'use client'

import { disablePostHog, enablePostHog, resetPostHogIdentity } from './client'

export function enablePostHogAnalyticsCapture(): boolean {
  return enablePostHog()
}

export function disablePostHogAnalyticsCapture(): boolean {
  disablePostHog()
  return false
}

export function setPostHogAnalyticsConsent(enabled: boolean): boolean {
  if (enabled) {
    return enablePostHogAnalyticsCapture()
  }

  return disablePostHogAnalyticsCapture()
}

export function resetPostHogBrowserIdentity(): boolean {
  return resetPostHogIdentity()
}
