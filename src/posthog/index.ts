/**
 * PostHog Integration
 * Centralized PostHog utilities for analytics, session replay, and error tracking
 */

// Server-side utilities
export { getPostHogServer, shutdownPostHogServer } from './server'

// Client-side utilities  
export { initializePostHog, posthog } from './client'

// User identification with optimization
export { identifyUser, resetIdentificationCache } from './identify'
