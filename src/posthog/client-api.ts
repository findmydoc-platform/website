'use client'

import { useSyncExternalStore } from 'react'

import {
  disablePostHog,
  enablePostHog,
  getPostHogSessionId,
  getPostHogReadiness,
  subscribePostHogReadiness,
  postHogBrowserEvents as postHogBrowserEventInterface,
  resetPostHogIdentity,
  type PostHogBrowserEventInterface,
} from './client'

export type { ClinicCtaClickedProperties, ClinicProfileViewedProperties } from './events'
export type { PostHogBrowserEventInterface } from './client'

export function enablePostHogAnalyticsCapture(): boolean {
  return enablePostHog()
}

function disablePostHogAnalyticsCapture(): boolean {
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

export function getConsentedPostHogSessionId(): string | undefined {
  return getPostHogSessionId()
}

export const postHogBrowserEvents: PostHogBrowserEventInterface = postHogBrowserEventInterface

const getServerReadiness = () => false

export function usePostHogAnalyticsReady(): boolean {
  return useSyncExternalStore(subscribePostHogReadiness, getPostHogReadiness, getServerReadiness)
}
