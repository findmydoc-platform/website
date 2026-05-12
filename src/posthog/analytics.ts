import { disablePostHogAnalyticsCapture, enablePostHogAnalyticsCapture, setPostHogAnalyticsConsent } from './client-api'

export function enableAnalyticsCapture() {
  return enablePostHogAnalyticsCapture()
}

export function disableAnalyticsCapture() {
  return disablePostHogAnalyticsCapture()
}

export function setAnalyticsConsent(enabled: boolean) {
  return setPostHogAnalyticsConsent(enabled)
}
