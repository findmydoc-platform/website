/**
 * PostHog Integration
 * Centralized PostHog utilities for analytics, session replay, and error tracking
 */

export {
  capturePostHogEvent,
  createPostHogFlagEvaluationContext,
  evaluatePostHogFlags,
  identifyPostHogActor,
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
} from './api'
