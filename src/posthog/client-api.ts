'use client'

import {
  disablePostHog,
  enablePostHog,
  postHogBrowserEvents as postHogBrowserEventInterface,
  resetPostHogIdentity,
  type PostHogBrowserEventInterface,
} from './client'

export type { ClinicCtaClickedProperties, ClinicProfileViewedProperties } from './events'
export type { PostHogBrowserEventInterface } from './client'

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

export const postHogBrowserEvents: PostHogBrowserEventInterface = postHogBrowserEventInterface
