import { selectIntegration } from './integration.mjs'
import { selectStorybook } from './storybook.mjs'
import { selectE2e } from './e2e.mjs'

export const EMAIL_FILES = [
  'tests/integration/transactionalEmail.delivery.test.ts',
  'tests/integration/transactionalEmail.retention.test.ts',
  'tests/integration/transactionalEmail.worker.test.ts',
]
export const SCENARIOS = {
  integration: { name: 'email-test-only', changes: EMAIL_FILES.map((path) => ({ status: 'M', path })) },
  storybook: {
    name: 'worker-route-only',
    changes: [{ status: 'M', path: 'src/app/api/internal/transactional-email/worker/route.ts' }],
  },
  e2e: {
    name: 'public-test-only',
    changes: [{ status: 'M', path: 'tests/e2e/public/clinic-detail.public-smoke.spec.ts' }],
  },
}

export function createPlan(topic, variant, input = SCENARIOS[topic], options) {
  if (!SCENARIOS[topic] || !['baseline', 'candidate'].includes(variant)) throw new Error('Unknown experiment variant')
  const selector = { integration: selectIntegration, storybook: selectStorybook, e2e: selectE2e }[topic]
  const decision = selector(input, options)
  return {
    version: 1,
    topic,
    variant,
    scenario: input === SCENARIOS[topic] ? SCENARIOS[topic].name : 'complete-pr-diff',
    sourceDiffKind: input === SCENARIOS[topic] ? 'controlled-path-manifest' : 'merge-base-name-status',
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
