import posthog from 'posthog-js'

import type {
  ClinicCtaClickedProperties,
  ClinicProfileViewedProperties,
  PostHogEventName,
  PostHogEventPropertiesByName,
  PostHogScalarProperty,
} from './events'

/**
 * Initialize PostHog client for browser-side tracking
 * Handles session replay, error tracking, and web analytics
 */
let isInitialized = false
let isCapturingEnabled = false

export function initializePostHog() {
  // Only initialize in browser environment
  if (typeof window === 'undefined') {
    return false
  }

  if (isInitialized) {
    return true
  }

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!posthogKey) {
    console.error('Error: NEXT_PUBLIC_POSTHOG_KEY environment variable is not set.')
    return false
  }

  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: '2025-05-24', // Latest version with improved features

    // Session Replay Configuration
    disable_session_recording: false, // Enable session recording (now that we have user identification)

    // Error Tracking Configuration
    capture_exceptions: true, // Enable automatic error capture

    // Prevents posthog-js from issuing browser-side flag requests; server code owns evaluation.
    advanced_disable_feature_flags: true,

    // Web Analytics Configuration
    capture_pageview: true, // Enable automatic pageview tracking
    capture_pageleave: true, // Track when users leave pages

    // Privacy and Performance
    mask_all_text: false, // Set to true in production if you want to mask text in replays
    mask_all_element_attributes: false,
  })

  isInitialized = true
  return true
}

export function enablePostHog() {
  const initialized = initializePostHog()
  if (!initialized) {
    isCapturingEnabled = false
    return false
  }

  try {
    posthog.opt_in_capturing({ captureEventName: false })
  } catch (error) {
    isCapturingEnabled = false
    console.warn('Failed to opt PostHog into capturing:', error)
    return false
  }

  isCapturingEnabled = true
  return true
}

export function disablePostHog() {
  resetPostHogIdentity()
  isInitialized = false
}

export function resetPostHogIdentity(): boolean {
  isCapturingEnabled = false

  try {
    posthog.opt_out_capturing()
  } catch (error) {
    console.warn('Failed to opt PostHog out of capturing:', error)
  }

  try {
    posthog.reset()
  } catch (error) {
    console.warn('Failed to reset PostHog after opt-out:', error)
  }

  return true
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
    posthog.capture(event, toDefinedScalarProperties(properties))
    return true
  } catch (error) {
    console.warn('Failed to capture PostHog browser event:', error)
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
