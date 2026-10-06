import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { suiteEvidence, requireGate } from '../../../scripts/ci-build-evidence.mjs'

const metric = { total: 1, covered: 1, skipped: 0, pct: 100 }
const coverage = { total: { lines: metric, statements: metric, functions: metric, branches: metric } }
const report = {
  success: true,
  numPassedTests: 1,
  numTotalTests: 1,
  numPassedTestSuites: 1,
  testResults: [
    {
      name: path.resolve('tests/unit/example.test.ts'),
      assertionResults: [{ status: 'passed', fullName: 'checks output' }],
    },
  ],
}
const needs = Object.fromEntries(
  [
    'classify',
    'ci-static',
    'unit-tests',
    'storybook-tests',
    'integration-tests',
    'coverage-merge',
    'build-late',
    'build-early',
  ].map((name) => [name, { result: name === 'build-early' ? 'skipped' : 'success' }]),
)

describe('Build diagnostic correctness receipts', () => {
  it('records stable case and coverage identities without failure bodies', () => {
    expect(suiteEvidence(report, coverage)).toMatchObject({ success: true, cases: 1, files: 1 })
    expect(suiteEvidence(report, coverage)).toEqual(suiteEvidence(report, coverage))
    expect(
      suiteEvidence(
        {
          ...report,
          testResults: [
            { ...report.testResults[0], assertionResults: [{ status: 'passed', fullName: 'different assertion' }] },
          ],
        },
        coverage,
      ).casesDigest,
    ).not.toBe(suiteEvidence(report, coverage).casesDigest)
  })
  it('counts physical files rather than nested describe suites', () => {
    expect(suiteEvidence({ ...report, numPassedTestSuites: 12 }, coverage).files).toBe(1)
    expect(() =>
      suiteEvidence({ ...report, testResults: [...report.testResults, ...report.testResults] }, coverage),
    ).toThrow('Duplicate test file')
  })
  it('rejects failed, skipped and incomplete suites', () => {
    for (const change of [{ success: false }, { numPendingTests: 1 }, { numTotalTests: 2 }, { numFailedTests: 1 }])
      expect(() => suiteEvidence({ ...report, ...change }, coverage)).toThrow()
  })
  it('accepts exactly one successful build and unchanged validation', () => {
    expect(requireGate(needs, { validation: true, buildRequired: true, integration: true })).toMatchObject({
      success: true,
      status: 'built',
    })
    expect(() =>
      requireGate(
        { ...needs, 'build-early': { result: 'success' } },
        { validation: true, buildRequired: true, integration: true },
      ),
    ).toThrow()
    expect(() =>
      requireGate(
        { ...needs, 'ci-static': { result: 'failure' } },
        { validation: true, buildRequired: true, integration: true },
      ),
    ).toThrow()
  })
  it('keeps a skipped build distinct from failed classification', () => {
    const skipped = Object.fromEntries(
      Object.entries(needs).map(([key, value]) => [
        key,
        { result: ['classify', 'coverage-merge'].includes(key) ? value.result : 'skipped' },
      ]),
    )
    expect(requireGate(skipped, { validation: false, buildRequired: true, integration: false })).toMatchObject({
      status: 'skipped',
      reason: 'existing-validation-skip',
    })
    expect(() =>
      requireGate(
        { ...skipped, classify: { result: 'failure' } },
        { validation: false, buildRequired: false, integration: false },
      ),
    ).toThrow()
  })
})

const workflow = parse(readFileSync('.github/workflows/ci-build-diagnostics.yml', 'utf8'))
const normal = parse(readFileSync('.github/workflows/deploy.yml', 'utf8'))
describe('Isolated build workflow contracts', () => {
  it('changes scheduling dependencies without changing build work', () => {
    expect(workflow.jobs['build-late'].steps).toEqual(workflow.jobs['build-early'].steps)
    expect(workflow.jobs['build-late'].needs).toEqual(['classify', 'ci-static', 'unit-tests', 'storybook-tests'])
    expect(workflow.jobs['build-early'].needs).toEqual(['classify'])
    expect(workflow.jobs['build-early'].if).toContain("inputs.experiment == 'schedule'")
    expect(workflow.jobs['build-late'].if).toContain("inputs.experiment == 'filter'")
  })
  it('preserves real suite commands and coverage instead of synthetic timings', () => {
    for (const [id, label] of [
      ['unit-tests', 'Run unit tests'],
      ['storybook-tests', 'Run Storybook tests'],
      ['integration-tests', 'Run integration tests'],
    ] as const) {
      const actual = workflow.jobs[id].steps.find((step: { name?: string }) => step.name === label).run
      const original = normal.jobs[id].steps.find((step: { name?: string }) => step.name === label).run
      expect(actual.split(' --reporter=')[0]).toBe(original.split(' --reporter=')[0])
      expect(actual).toContain('--coverage')
    }
    expect(workflow.jobs['coverage-merge'].needs).toContain('integration-tests')
  })
  it('contains no deployment or package/compiler cache and is manual only', () => {
    expect(Object.keys(workflow.on)).toEqual(['workflow_call'])
    expect(workflow.permissions).toEqual({ contents: 'read' })
    for (const job of Object.values(workflow.jobs) as Array<{
      steps: Array<{ uses?: string; run?: string; with?: Record<string, unknown> }>
    }>)
      for (const step of job.steps) {
        expect(step.uses?.startsWith('actions/cache')).not.toBe(true)
        expect(step.run ?? '').not.toMatch(/vercel (deploy|build)|gh (pr|issue)/)
      }
  })
})
