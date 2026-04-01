import posthog from 'posthog-js'

/**
 * Initialize PostHog client for browser-side tracking
 * Handles session replay, error tracking, and web analytics
 */
let isInitialized = false

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
  try {
    posthog.opt_in_capturing({ captureEventName: false })
  } catch (error) {
    console.warn('Failed to opt PostHog into capturing:', error)
  }
  return initialized
}

export function disablePostHog() {
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

  isInitialized = false
}

// Export posthog instance for direct use if needed
export { posthog }
