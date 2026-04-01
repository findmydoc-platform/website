/**
 * PostHog Client-side utilities only
 * Safe to import in client components
 */

// Client-side utilities only
export { disableAnalyticsCapture, enableAnalyticsCapture, setAnalyticsConsent } from './analytics'
export { disablePostHog, enablePostHog, initializePostHog, posthog } from './client'
