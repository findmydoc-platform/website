/**
 * PostHog Integration
 * Centralized PostHog utilities for analytics, session replay, and error tracking
 */

export {
  createPostHogFlagEvaluationContext,
  evaluatePostHogFlags,
  identifyPostHogActor,
  postHogServerEvents,
  POSTHOG_EVENT_REGISTRY,
  POSTHOG_FLAG_REGISTRY,
  resolveAnonymousPostHogActor,
  resolvePostHogSiteFlagActor,
  resolvePostHogActor,
  resetPostHogClientForTests,
  type PostHogActor,
  type PostHogEventName,
  type PostHogFlagEvaluationContext,
  type PostHogFlagKey,
  type PostHogFlagSnapshot,
  type PostHogServerAnalyticsConsent,
  type PostHogServerConsentInterface,
  type PostHogServerEventInterface,
  type PostHogServerEventInput,
} from './api'
