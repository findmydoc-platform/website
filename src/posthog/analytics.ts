import { disablePostHog, enablePostHog } from './client'

export function enableAnalyticsCapture() {
  return enablePostHog()
}

export function disableAnalyticsCapture() {
  disablePostHog()
}

export function setAnalyticsConsent(enabled: boolean) {
  if (enabled) {
    return enableAnalyticsCapture()
  }

  disableAnalyticsCapture()
  return false
}
