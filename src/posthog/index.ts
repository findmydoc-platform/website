/**
 * PostHog Integration
 * Centralized PostHog utilities for analytics, session replay, and error tracking
 */

export {
  capturePostHogEvent,
  evaluatePostHogFlags,
  identifyPostHogActor,
  POSTHOG_EVENT_REGISTRY,
  POSTHOG_FLAG_REGISTRY,
  resolvePostHogActor,
  resetPostHogClientForTests,
  type PostHogActor,
  type PostHogEventName,
  type PostHogFlagKey,
  type PostHogFlagSnapshot,
} from './api'
