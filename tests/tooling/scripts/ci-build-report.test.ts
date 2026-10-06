import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { measureBuildRun, renderBuildReport, summarizeBuildRuns } from '../../../scripts/ci-build-report.mjs'

const commit = 'a'.repeat(40)
const digest = 'b'.repeat(64)
const at = (milliseconds: number) => new Date(Date.UTC(2026, 9, 6) + milliseconds).toISOString()
const roots: string[] = []
const coverage = {
  lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
  statements: { total: 100, covered: 80, skipped: 0, pct: 80 },
}
const suite = (files = 10, cases = 100) => ({
  success: true,
  files,
  cases,
  casesDigest: digest,
  coverageDigest: digest,
  coverage: structuredClone(coverage),
})
type Step = { name: string; status: string; conclusion: string; started_at: string | null; completed_at: string | null }
type Job = {
  id: number
  name: string
  status: string
  conclusion: string
  started_at: string | null
  completed_at: string | null
  steps: Step[]
}

function fixture(experiment = 'filter', scenario = 'runtime', variant = 'baseline', round = 1) {
  const validation = experiment === 'schedule' || scenario !== 'docs'
  const integration = experiment === 'schedule'
  const buildRequired = experiment === 'schedule' || (validation && (variant === 'baseline' || scenario === 'runtime'))
  const build = buildRequired && validation
  const early = experiment === 'schedule' && variant === 'candidate'
  const jobs: Job[] = []
  const add = (name: string, start: number, end: number, execute = true) => {
    const job: Job = {
      id: jobs.length + 1,
      name: `Build diagnostics / ${name}`,
      status: 'completed',
      conclusion: execute ? 'success' : 'skipped',
      started_at: execute ? at(start) : null,
      completed_at: execute ? at(end) : null,
      steps: [],
    }
    jobs.push(job)
    return job
  }
  add('Classify', 1000, 2000)
  add('Static Checks', 2000, 9000, validation)
  add('Unit Tests', 2000, 8000, validation)
  add('Storybook Tests', 2000, 10000, validation)
  const buildStart = early ? 2000 : 10000
  const buildEnd = buildStart + 10000
  for (const lane of ['late', 'early']) {
    const entry = add(`Build ${lane}`, buildStart, buildEnd, build && (lane === 'early') === early)
    if (entry.conclusion === 'success')
      entry.steps.push({
        name: 'Build application (static check)',
        status: 'completed',
        conclusion: 'success',
        started_at: at(buildStart + 1000),
        completed_at: at(buildEnd - 500),
      })
  }
  const integrationStart = Math.max(9000, buildEnd)
  const integrationEnd = integrationStart + 12000
  add('Integration Tests', integrationStart, integrationEnd, integration)
  const coverageStart = integration ? integrationEnd : validation ? 10000 : 2000
  add('Combined Coverage', coverageStart, coverageStart + 1000)
  const gateStart = Math.max(coverageStart + 1000, build ? buildEnd : 0)
  add('Build', gateStart, gateStart + 1000)
  add('Old shard experiment', 0, 0, false)
  const correctness = {
    scope: { success: true, workflowDigest: digest, filesDigest: digest, validation, buildRequired, integration },
    unit: validation ? suite() : null,
    storybook: validation ? suite(5, 50) : null,
    integration: integration ? suite(98, 877) : null,
    build: build ? { success: true, outputVerified: true, routes: 30, routesDigest: digest } : null,
    gate: { success: true, status: build ? 'built' : 'skipped' },
  }
  return {
    experiment,
    scenario,
    variant,
    round,
    commit,
    contractDigest: digest,
    filesDigest: digest,
    failure: 'none',
    run: {
      id:
        round * 1000 +
        (variant === 'candidate' ? 100 : 0) +
        (experiment === 'schedule' ? 10 : 0) +
        ['docs', 'tests', 'metadata', 'runtime'].indexOf(scenario),
      status: 'completed',
      conclusion: 'success',
      created_at: at(0),
      run_started_at: at(1000),
      updated_at: at(gateStart + 2000),
    },
    jobs,
    decisions: { validation, buildRequired, integration },
    correctness,
  }
}
function pairs(experiment = 'filter', scenario = 'runtime') {
  return [1, 2, 3].flatMap((round) =>
    ['baseline', 'candidate'].map((variant) => fixture(experiment, scenario, variant, round)),
  )
}
function job(input: ReturnType<typeof fixture>, name: string) {
  const selected = input.jobs.find((value) => value.name.endsWith(` / ${name}`))
  if (!selected) throw new Error('Fixture job missing')
  return selected
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('measureBuildRun', () => {
  it('uses actual wall time, full runner sum, queue and successful build-step completion', () => {
    const result = measureBuildRun(fixture('schedule'))
    expect(result.accepted).toBe(true)
    expect(result.metrics).toMatchObject({
      elapsedMs: 33000,
      runnerMs: 46000,
      initialQueueMs: 1000,
      buildReadyMs: 18500,
      validationReadyMs: 32000,
      buildJobCount: 1,
    })
    expect(result.buildReadyAt).toBe(at(19500))
    expect(result.workflowCompletion).toMatchObject({
      source: 'updated_at',
      preliminary: true,
      elapsedFromCreatedMs: 35000,
    })
    expect(result.jobs.filter((entry: { role: string }) => entry.role === 'build')).toHaveLength(2)
    expect(result.jobs.filter((entry: { role: string }) => entry.role === 'gate')).toHaveLength(1)
  })
  it('supports docs coverage work, skipped application builds and no Result job', () => {
    const input = fixture('filter', 'docs')
    expect(measureBuildRun(input)).toMatchObject({
      accepted: true,
      metrics: { elapsedMs: 3000, runnerMs: 3000, buildJobCount: 0, buildReadyMs: null, validationReadyMs: 2000 },
    })
    input.decisions.buildRequired = true
    input.correctness.scope.buildRequired = true
    expect(measureBuildRun(input).accepted).toBe(true)
  })
  it('supports metadata filter candidates without an application build', () => {
    expect(measureBuildRun(fixture('filter', 'metadata', 'candidate'))).toMatchObject({
      accepted: true,
      metrics: { buildJobCount: 0, buildReadyMs: null },
    })
  })
  it('retains failed job cost and rejects incomplete or cancelled work', () => {
    const input = fixture('schedule')
    job(input, 'Static Checks').conclusion = 'failure'
    input.run.conclusion = 'failure'
    expect(measureBuildRun(input)).toMatchObject({ accepted: false, metrics: { runnerMs: 46000 } })
    job(input, 'Build late').completed_at = null
    expect(measureBuildRun(input).metrics.runnerMs).toBe(36000)
    expect(measureBuildRun(input).rejectionReasons).toContain('missing-job-timestamps')
    job(input, 'Unit Tests').conclusion = 'cancelled'
    expect(measureBuildRun(input).rejectionReasons).toContain('job-not-successful-complete')
  })
  it.each(['Static Checks', 'Unit Tests', 'Storybook Tests', 'Integration Tests', 'Combined Coverage'])(
    'rejects a skipped required schedule suite: %s',
    (name) => {
      const input = fixture('schedule')
      job(input, name).conclusion = 'skipped'
      expect(measureBuildRun(input).accepted).toBe(false)
    },
  )
  it('rejects duplicate executed build lanes and an unexpectedly skipped required build', () => {
    const input = fixture('schedule')
    job(input, 'Build early').conclusion = 'success'
    expect(measureBuildRun(input).rejectionReasons).toContain('multiple-executed-builds')
    job(input, 'Build early').conclusion = 'skipped'
    job(input, 'Build late').conclusion = 'skipped'
    expect(measureBuildRun(input).rejectionReasons).toContain('required-build-skipped')
  })
  it('requires the successful application step rather than substituting job completion', () => {
    const input = fixture('schedule')
    job(input, 'Build late').steps[0]!.conclusion = 'failure'
    expect(measureBuildRun(input)).toMatchObject({ accepted: false, metrics: { buildReadyMs: null } })
    expect(measureBuildRun(input).rejectionReasons).toContain('missing-successful-build-step')
  })
  it('requires suite/build correctness, matching classification and a truthful gate', () => {
    for (const kind of ['unit', 'storybook', 'integration'] as const) {
      const input = fixture('schedule')
      input.correctness[kind]!.success = false
      expect(measureBuildRun(input).rejectionReasons).toContain(`missing-successful-${kind}-receipt`)
    }
    const input = fixture('schedule')
    input.correctness.build!.outputVerified = false
    expect(measureBuildRun(input).rejectionReasons).toContain('missing-verified-build-receipt')
    input.correctness.gate.status = 'skipped'
    expect(measureBuildRun(input).rejectionReasons).toContain('gate-receipt-mismatch')
    input.correctness.scope.workflowDigest = 'c'.repeat(64)
    expect(measureBuildRun(input).rejectionReasons).toContain('scope-receipt-mismatch')
  })
  it('rejects reduced schedule integration selection', () => {
    const input = fixture('schedule')
    input.correctness.integration!.cases = 876
    expect(measureBuildRun(input).rejectionReasons).toContain('schedule-integration-selection-mismatch')
  })
})

describe('summarizeBuildRuns', () => {
  it('keeps independent experiment medians and ranges rather than pooling', () => {
    const report = summarizeBuildRuns([...pairs('filter', 'tests'), ...pairs('schedule')])
    expect(report.accepted).toBe(true)
    expect(report.groups).toHaveLength(2)
    expect(
      report.groups.find((group: { experiment: string }) => group.experiment === 'filter')!.gainBounds,
    ).toMatchObject({
      elapsedSavedMs: { medianMs: 9000, minMs: 9000, maxMs: 9000 },
      runnerSavedMs: { medianMs: 10000 },
    })
    expect(
      report.groups.find((group: { experiment: string }) => group.experiment === 'schedule')!.gainBounds,
    ).toMatchObject({
      elapsedSavedMs: { medianMs: 8000 },
      runnerSavedMs: { medianMs: 0 },
      buildReadySavedMs: { medianMs: 8000 },
    })
    expect(report.approaches).toHaveLength(2)
    expect(report).not.toHaveProperty('pooledMedianSavedMs')
  })
  it('reports legitimate zero docs gains when both variants skip application builds', () => {
    const report = summarizeBuildRuns(pairs('filter', 'docs'))
    expect(report.accepted).toBe(true)
    expect(report.groups[0]!.gainBounds).toMatchObject({
      elapsedSavedMs: { medianMs: 0 },
      runnerSavedMs: { medianMs: 0 },
      buildReadySavedMs: null,
    })
    expect(report.groups[0]!.rows.every((row) => 'buildJobsAvoided' in row && row.buildJobsAvoided === 0)).toBe(true)
  })
  it('returns useful partial groups and costs after the first completed run', () => {
    const report = summarizeBuildRuns([fixture()])
    expect(report.accepted).toBe(false)
    expect(report.groups[0]!.gainBounds).toBeNull()
    expect(report.rejectionReasons).toContain('missing-or-duplicate-round-pair')
    expect(report.entries).toHaveLength(1)
    expect(report.cumulativeCost.measuredRunnerMs).toBeGreaterThan(0)
    expect(summarizeBuildRuns([])).toMatchObject({ accepted: false, rejectionReasons: ['no-measurements'] })
  })
  it.each(['commit', 'contractDigest', 'filesDigest'] as const)('rejects mixed comparison identity: %s', (field) => {
    const input = pairs()
    input[1]![field] = 'c'.repeat(field === 'commit' ? 40 : 64)
    const report = summarizeBuildRuns(input)
    expect(report.accepted).toBe(false)
    expect(report.groups[0]!.gainBounds).toBeNull()
    expect(report.entries).toHaveLength(6)
  })
  it('rejects duplicate rounds and asymmetric scenario selection', () => {
    const input = pairs()
    expect(summarizeBuildRuns([...input, structuredClone(input[0]!)]).groups[0]!.gainBounds).toBeNull()
    input[1]!.scenario = 'tests'
    expect(summarizeBuildRuns(input).groups.every((group) => !group.accepted)).toBe(true)
  })
  it.each(['cases', 'casesDigest', 'coverageDigest', 'coverage'] as const)(
    'rejects changed cases or coverage within a pair: %s',
    (field) => {
      const input = pairs('schedule')
      const receipt = input[1]!.correctness.unit!
      if (field === 'cases') receipt.cases += 1
      else if (field === 'coverage') receipt.coverage.lines.covered -= 1
      else receipt[field] = 'c'.repeat(64)
      const report = summarizeBuildRuns(input)
      expect(report.accepted).toBe(false)
      expect(report.groups[0]!.rejectionReasons).toContain('unit-receipt-mismatch')
      expect(report.groups[0]!.rows[0]!.deltas).toBeNull()
    },
  )
  it('requires the same generated route set when both variants build', () => {
    const input = pairs('schedule')
    input[1]!.correctness.build!.routesDigest = 'c'.repeat(64)
    expect(summarizeBuildRuns(input).groups[0]!.rejectionReasons).toContain('build-routes-mismatch')
  })
  it('keeps controlled failure probes and their cost outside performance pairs', () => {
    const probe = fixture('schedule', 'runtime', 'candidate')
    probe.failure = 'static'
    probe.run.id = 9999
    probe.run.conclusion = 'failure'
    job(probe, 'Static Checks').conclusion = 'failure'
    job(probe, 'Build').conclusion = 'failure'
    const report = summarizeBuildRuns([...pairs('schedule'), probe])
    expect(report.accepted).toBe(true)
    expect(report.rejectionReasons).toEqual([])
    expect(report.groups[0]!.accepted).toBe(true)
    expect(report.failureProbes).toHaveLength(1)
    expect(report.failureProbes[0]!.accepted).toBe(false)
    expect(report.failureProbes[0]!.rejectionReasons).toContain('failure-probe-not-performance-evidence')
    expect(report.rejectedEntries).toHaveLength(1)
    expect(report.cumulativeCost.rejectedRunnerMs).toBeGreaterThan(0)
    expect(report.groups[0]!.rows).toHaveLength(3)
    expect(summarizeBuildRuns([probe])).toMatchObject({
      accepted: false,
      rejectionReasons: ['no-performance-measurements'],
      groups: [],
    })
    const failedPerformance = pairs('schedule')
    failedPerformance[0]!.run.conclusion = 'failure'
    expect(summarizeBuildRuns([...failedPerformance, probe]).accepted).toBe(false)
  })
  it('retains incomplete job cost as a lower bound before rejecting comparisons', () => {
    const input = fixture()
    job(input, 'Build late').completed_at = null
    const report = summarizeBuildRuns([input])
    expect(report.cumulativeCost.complete).toBe(false)
    expect(report.cumulativeCost.rejectedRunnerMs).toBeGreaterThan(0)
  })
  it('does not copy secrets, raw names, URLs or arbitrary payloads into output', () => {
    const secret = 'private-account-secret'
    const input = {
      ...fixture(),
      token: secret,
      correctness: { ...fixture().correctness, private: secret },
      run: { ...fixture().run, html_url: `https://${secret}.invalid` },
    }
    input.jobs[0]!.name = `${secret} / Classify`
    const report = summarizeBuildRuns([input])
    expect(JSON.stringify(report)).not.toContain(secret)
    expect(renderBuildReport(report)).not.toContain(secret)
  })
  it('writes JSON and Markdown offline even when comparison evidence is partial', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ci-build-report-test-'))
    roots.push(root)
    const input = join(root, 'measurements.json')
    const output = join(root, 'report.json')
    await writeFile(input, JSON.stringify([fixture()]))
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/ci-build-report.mjs'), '--input', input, '--output', output],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(0)
    expect(JSON.parse(await readFile(output, 'utf8'))).toMatchObject({
      accepted: false,
      schemaVersion: 1,
      kind: 'build',
    })
    expect(await readFile(join(root, 'report.md'), 'utf8')).toContain('API updated_at is preliminary')
  })
})
