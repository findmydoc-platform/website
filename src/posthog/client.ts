import posthog from 'posthog-js'

import type {
  ClinicCtaClickedProperties,
  ClinicProfileViewedProperties,
  PostHogEventName,
  PostHogEventPropertiesByName,
  PostHogScalarProperty,
} from './events'

// Initialization, the site's consent decision, and SDK readiness have separate lifetimes.
let isInitialized = false
let isLoaded = false
let desiredConsent = false
let isCapturingEnabled = false
const readinessListeners = new Set<() => void>()

function setReadiness(ready: boolean): void {
  if (isCapturingEnabled === ready) return
  isCapturingEnabled = ready
  for (const listener of readinessListeners) listener()
}

export function subscribePostHogReadiness(listener: () => void): () => void {
  readinessListeners.add(listener)
  return () => readinessListeners.delete(listener)
}

export function getPostHogReadiness(): boolean {
  return isCapturingEnabled
}

function hasConfirmedConsent(): boolean {
  return Boolean(
    isInitialized &&
    isLoaded &&
    posthog.config.token === process.env.NEXT_PUBLIC_POSTHOG_KEY &&
    posthog.has_opted_in_capturing() &&
    !posthog.has_opted_out_capturing(),
  )
}

function applyDesiredConsent(): boolean {
  if (!isInitialized || !isLoaded) return false
  if (isCapturingEnabled && desiredConsent) return true
  try {
    if (desiredConsent) {
      posthog.opt_in_capturing({ captureEventName: false })
      setReadiness(hasConfirmedConsent())
    } else {
      posthog.opt_out_capturing()
      setReadiness(false)
    }
  } catch {
    setReadiness(false)
    console.warn('PostHog consent could not be confirmed.')
  }
  return isCapturingEnabled
}

export function initializePostHog(): boolean {
  if (typeof window === 'undefined') return false
  if (isInitialized) return true

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!posthogKey) {
    console.warn('PostHog initialization is unavailable.')
    return false
  }

  try {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      defaults: '2025-05-24',
      opt_out_capturing_by_default: true,
      disable_session_recording: false,
      capture_exceptions: true,
      // Server code owns feature flag evaluation.
      advanced_disable_feature_flags: true,
      capture_pageview: true,
      capture_pageleave: true,
      mask_all_text: false,
      mask_all_element_attributes: false,
      loaded: () => {
        isLoaded = true
        applyDesiredConsent()
      },
    })
    isInitialized = posthog.config.token === posthogKey
    return isInitialized
  } catch {
    isLoaded = false
    setReadiness(false)
    console.warn('PostHog initialization failed.')
    return false
  }
}

export function enablePostHog(): boolean {
  desiredConsent = true
  if (!initializePostHog()) return false
  return applyDesiredConsent()
}

export function disablePostHog(): void {
  desiredConsent = false
  resetPostHogIdentity()
}

export function resetPostHogIdentity(): boolean {
  setReadiness(false)
  // Do not let the SDK write consent for its uninitialized, empty token.
  if (!isInitialized || !isLoaded) return true

  try {
    // reset() clears SDK consent. Reapply the site's decision after identity reset.
    posthog.reset()
  } catch {
    try {
      posthog.opt_out_capturing()
    } catch {
      // The application capture gate remains closed even if SDK storage fails.
    }
    console.warn('PostHog identity reset failed.')
    return false
  }

  applyDesiredConsent()
  return desiredConsent ? isCapturingEnabled : !isCapturingEnabled
}

export function getPostHogSessionId(): string | undefined {
  if (typeof window === 'undefined' || !isInitialized || !isCapturingEnabled) return undefined

  try {
    const sessionId = posthog.get_session_id()
    return typeof sessionId === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(sessionId) ? sessionId : undefined
  } catch {
    return undefined
  }
}

const toDefinedScalarProperties = <Name extends PostHogEventName>(
  value: PostHogEventPropertiesByName[Name],
): Record<string, PostHogScalarProperty> => {
  const properties: Record<string, PostHogScalarProperty> = {}

  for (const [propertyName, propertyValue] of Object.entries(
    value as Record<string, PostHogScalarProperty | undefined>,
  )) {
    if (propertyValue !== undefined) {
      properties[propertyName] = propertyValue
    }
  }

  return properties
}

function captureBrowserPostHogEvent<Name extends PostHogEventName>(
  event: Name,
  properties: PostHogEventPropertiesByName[Name],
): boolean {
  if (typeof window === 'undefined' || !isInitialized || !isCapturingEnabled) {
    return false
  }

  try {
    return Boolean(posthog.capture(event, toDefinedScalarProperties(properties)))
  } catch {
    console.warn('PostHog browser event capture failed.')
    return false
  }
}

export interface PostHogBrowserEventInterface {
  clinicCtaClicked(properties: ClinicCtaClickedProperties): boolean
  clinicProfileViewed(properties: ClinicProfileViewedProperties): boolean
}

export const postHogBrowserEvents: PostHogBrowserEventInterface = {
  clinicCtaClicked: (properties) => captureBrowserPostHogEvent('clinic_cta_clicked', properties),
  clinicProfileViewed: (properties) => captureBrowserPostHogEvent('clinic_profile_viewed', properties),
}
