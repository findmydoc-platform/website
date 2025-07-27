import posthog from 'posthog-js'

/**
 * Initialize PostHog client for browser-side tracking
 * Handles session replay, error tracking, and web analytics
 */
export function initializePostHog() {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
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
}

// Initialize immediately
initializePostHog()

// Export posthog instance for direct use if needed
export { posthog }
