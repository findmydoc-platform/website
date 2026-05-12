/**
 * PostHog Client-side utilities only
 * Safe to import in client components
 */

export {
  disablePostHogAnalyticsCapture,
  enablePostHogAnalyticsCapture,
  resetPostHogBrowserIdentity,
  setPostHogAnalyticsConsent,
} from './client-api'
