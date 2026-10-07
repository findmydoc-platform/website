import { selectIntegration } from './integration.mjs'
import { selectStorybook } from './storybook.mjs'
import { selectE2e } from './e2e.mjs'

export const EMAIL_FILES = [
  'tests/integration/transactionalEmail.delivery.test.ts',
  'tests/integration/transactionalEmail.retention.test.ts',
  'tests/integration/transactionalEmail.worker.test.ts',
]
export const CATEGORIES_FILES = ['tests/integration/categories.lifecycle.test.ts']
export const REVIEWS_FILES = [
  'tests/integration/access/reviews-access.test.ts',
  'tests/integration/migrations/reviewResponsesAppeals.test.ts',
  'tests/integration/migrations/reviewVersionedModerationFoundation.test.ts',
  'tests/integration/reviewAppeals.lifecycle.test.ts',
  'tests/integration/reviewResponses.lifecycle.test.ts',
  'tests/integration/reviews.auditTrail.test.ts',
  'tests/integration/reviews.averageRatings.test.ts',
  'tests/integration/reviews.duplicateGuard.test.ts',
  'tests/integration/reviews.lifecycle.test.ts',
  'tests/integration/reviews.publication.test.ts',
  'tests/integration/reviews.versioning.test.ts',
  'tests/integration/seedReviewWorkflow.integration.test.ts',
]
export const INTEGRATION_GROUPS = {
  email: { name: 'email-test-only', changes: EMAIL_FILES.map((path) => ({ status: 'M', path })) },
  categories: { name: 'categories-test-only', changes: CATEGORIES_FILES.map((path) => ({ status: 'M', path })) },
  reviews: { name: 'reviews-test-only', changes: REVIEWS_FILES.map((path) => ({ status: 'M', path })) },
}
export const SCENARIOS = {
  integration: INTEGRATION_GROUPS.email,
  storybook: {
    name: 'worker-route-only',
    changes: [{ status: 'M', path: 'src/app/api/internal/transactional-email/worker/route.ts' }],
  },
  e2e: {
    name: 'public-test-only',
    changes: [{ status: 'M', path: 'tests/e2e/public/clinic-detail.public-smoke.spec.ts' }],
  },
}

export function createPlan(topic, variant, input, options = {}) {
  if (!Object.hasOwn(SCENARIOS, topic) || !['baseline', 'candidate'].includes(variant))
    throw new Error('Unknown experiment variant')
  if (options.group !== undefined && topic !== 'integration') throw new Error('Groups are integration-only')
  const group = options.group === undefined ? 'email' : options.group
  if (typeof group !== 'string' || !Object.hasOwn(INTEGRATION_GROUPS, group))
    throw new Error('Unknown integration group')
  const scenario = topic === 'integration' ? INTEGRATION_GROUPS[group] : SCENARIOS[topic]
  if (input === undefined) input = scenario
  const controlledScenario =
    topic === 'integration'
      ? Object.values(INTEGRATION_GROUPS).find((manifest) => input === manifest)
      : input === scenario
        ? scenario
        : undefined
  const selector = { integration: selectIntegration, storybook: selectStorybook, e2e: selectE2e }[topic]
  const decision = selector(input, options)
  return {
    version: 1,
    topic,
    variant,
    scenario: controlledScenario ? controlledScenario.name : 'complete-pr-diff',
    sourceDiffKind: controlledScenario ? 'controlled-path-manifest' : 'merge-base-name-status',
    input,
    decision,
    execution:
      variant === 'baseline'
        ? {
            ...decision,
            mode: 'full',
            files: [],
            lanes: topic === 'e2e' ? ['admin', 'public'] : [],
            reasons: ['reference-full-execution'],
          }
        : decision,
    coverageContract:
      topic === 'integration' && variant === 'candidate' && decision.mode === 'selected'
        ? 'partial-diagnostic'
        : 'full-suite',
  }
}
