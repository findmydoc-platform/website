/**
 * PostHog Integration
 * Centralized PostHog utilities for analytics, session replay, and error tracking
 *
 * Note: For client components that only need PostHog client,
 * import from '@/posthog/client-only' to avoid bundling server code
 */

// Client-side utilities
export { initializePostHog, posthog } from './client'

// Server-side utilities - DO NOT import in client components
export { getPostHogServer, shutdownPostHogServer } from './server'

// User identification with optimization - server-side only
export { identifyUser, resetIdentificationCache } from './identify'
