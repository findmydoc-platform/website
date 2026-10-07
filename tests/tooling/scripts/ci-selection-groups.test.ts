import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createPlan,
  CATEGORIES_FILES,
  EMAIL_FILES,
  INTEGRATION_GROUPS,
  REVIEWS_FILES,
  SCENARIOS,
} from '../../../scripts/ci-selection-poc/plan.mjs'

const root = path.resolve(import.meta.dirname, '../../..')
const contract = 'tests/integration/contracts/collectionContractCoverage.test.ts'

describe('controlled integration group plans', () => {
  it('keeps the email default and its controlled provenance', () => {
    const implicit = createPlan('integration', 'candidate', undefined, { root })
    const explicit = createPlan('integration', 'candidate', undefined, { root, group: 'email' })
    expect(implicit).toEqual(explicit)
    expect(implicit).toMatchObject({
      scenario: 'email-test-only',
      sourceDiffKind: 'controlled-path-manifest',
      decision: { mode: 'selected', files: EMAIL_FILES, lanes: [], shadowFiles: [] },
      coverageContract: 'partial-diagnostic',
    })
    expect(implicit.input).toBe(SCENARIOS.integration)
  })

  it('selects the category lifecycle and its source-reading contract', () => {
    const plan = createPlan('integration', 'candidate', undefined, { root, group: 'categories' })
    expect(CATEGORIES_FILES).toEqual(['tests/integration/categories.lifecycle.test.ts'])
    expect(plan).toMatchObject({
      scenario: 'categories-test-only',
      sourceDiffKind: 'controlled-path-manifest',
      input: { changes: [{ status: 'M', path: 'tests/integration/categories.lifecycle.test.ts' }] },
      execution: {
        mode: 'selected',
        files: ['tests/integration/categories.lifecycle.test.ts', contract],
        lanes: [],
        shadowFiles: [],
      },
      coverageContract: 'partial-diagnostic',
    })
    expect(plan.execution.reasons).toContain('registry-contract-reads-modified-test')
  })

  it('retains all twelve review files and adds exactly the registry contract', () => {
    const expected = [
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
    const plan = createPlan('integration', 'candidate', undefined, { root, group: 'reviews' })
    expect(REVIEWS_FILES).toEqual(expected)
    expect(plan).toMatchObject({
      scenario: 'reviews-test-only',
      sourceDiffKind: 'controlled-path-manifest',
      input: { changes: expected.map((path) => ({ status: 'M', path })) },
      execution: { mode: 'selected', files: [...expected, contract].sort(), lanes: [], shadowFiles: [] },
      coverageContract: 'partial-diagnostic',
    })
    expect(plan.execution.files).toHaveLength(13)
  })

  it.each(['email', 'categories', 'reviews'])('keeps the %s baseline on full-suite coverage', (group) => {
    const baseline = createPlan('integration', 'baseline', undefined, { root, group })
    const candidate = createPlan('integration', 'candidate', undefined, { root, group })
    expect(baseline.input).toEqual(candidate.input)
    expect(baseline.scenario).toBe(candidate.scenario)
    expect(baseline.decision).toEqual(candidate.decision)
    expect(baseline.execution).toMatchObject({
      mode: 'full',
      files: [],
      lanes: [],
      reasons: ['reference-full-execution'],
    })
    expect(baseline.coverageContract).toBe('full-suite')
  })

  it('recognizes the explicitly exported controlled group manifest', () => {
    const plan = createPlan('integration', 'candidate', INTEGRATION_GROUPS.categories, { root, group: 'categories' })
    expect(plan.sourceDiffKind).toBe('controlled-path-manifest')
    expect(plan.scenario).toBe('categories-test-only')
  })

  it('retains the actual controlled manifest provenance when a default group is unused', () => {
    const plan = createPlan('integration', 'candidate', INTEGRATION_GROUPS.reviews, { root })
    expect(plan.sourceDiffKind).toBe('controlled-path-manifest')
    expect(plan.scenario).toBe('reviews-test-only')
    expect(plan.execution.files).toEqual([...REVIEWS_FILES, contract].sort())
  })

  it('never replaces a real diff with the requested controlled group', () => {
    const input = {
      changes: [
        { status: 'M', path: 'tests/integration/categories.lifecycle.test.ts' },
        { status: 'M', path: 'tests/fixtures/ensureBaseline.ts' },
      ],
    }
    const plan = createPlan('integration', 'candidate', input, { root, group: 'reviews' })
    expect(plan.input).toBe(input)
    expect(plan).toMatchObject({
      scenario: 'complete-pr-diff',
      sourceDiffKind: 'merge-base-name-status',
      decision: { mode: 'full', files: [] },
      execution: { mode: 'full', files: [] },
      coverageContract: 'full-suite',
    })
    expect(plan.decision.reasons).toContain('unmapped-or-shared-path:tests/fixtures/ensureBaseline.ts')
  })

  it('does not claim controlled provenance for a real diff with identical filenames', () => {
    const input = { changes: [{ status: 'M', path: 'tests/integration/categories.lifecycle.test.ts' }] }
    const plan = createPlan('integration', 'candidate', input, { root, group: 'categories' })
    expect(plan).toMatchObject({ scenario: 'complete-pr-diff', sourceDiffKind: 'merge-base-name-status' })
    expect(plan.execution.files).toEqual(['tests/integration/categories.lifecycle.test.ts', contract])
  })

  it('passes the requested root to the selector and falls back for missing group files', () => {
    const missingRoot = mkdtempSync(path.join(tmpdir(), 'ci-selection-groups-'))
    try {
      const plan = createPlan('integration', 'candidate', undefined, { root: missingRoot, group: 'categories' })
      expect(plan.execution).toMatchObject({
        mode: 'full',
        files: [],
        reasons: ['missing-test-file:tests/integration/categories.lifecycle.test.ts'],
      })
      expect(plan.coverageContract).toBe('full-suite')
    } finally {
      rmSync(missingRoot, { recursive: true, force: true })
    }
  })

  it.each(['unknown', '__proto__', 'constructor', '', null, 0, {}, ['email']])('rejects unknown group %j', (group) => {
    expect(() => createPlan('integration', 'candidate', undefined, { root, group })).toThrow(
      'Unknown integration group',
    )
  })

  it.each(['storybook', 'e2e'])('rejects a group on topic %s while preserving its default', (topic) => {
    expect(() => createPlan(topic, 'candidate', undefined, { group: 'categories' })).toThrow('integration-only')
    expect(createPlan(topic, 'candidate')).toMatchObject({ sourceDiffKind: 'controlled-path-manifest' })
  })

  it('preserves validation of topic and variant', () => {
    expect(() => createPlan('unknown', 'candidate')).toThrow('Unknown experiment variant')
    expect(() => createPlan('constructor', 'candidate')).toThrow('Unknown experiment variant')
    expect(() => createPlan('integration', 'unknown', undefined, { group: 'categories' })).toThrow(
      'Unknown experiment variant',
    )
  })
})
