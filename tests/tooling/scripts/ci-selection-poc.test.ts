import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { parseNameStatus, collectChanges } from '../../../scripts/ci-selection-poc/changes.mjs'
import { validateInput } from '../../../scripts/ci-selection-poc/common.mjs'
import {
  comparePair,
  physicalRunnerSeconds,
  summarize,
  validateRun,
} from '../../../scripts/ci-selection-poc/results.mjs'

const receipt = (variant = 'baseline') => ({
  commit: 'a'.repeat(40),
  topic: 'integration',
  round: 1,
  node: 'v24.14.0',
  pnpm: '10.28.2',
  scenario: 'tests',
  topology: 'one-serial-runner',
  variant,
  mode: 'full',
  status: 'success',
  expectedFiles: ['tests/integration/example.test.ts'],
  reasons: [],
  report: {
    reason: 'passed',
    unhandledErrors: 0,
    modules: [
      { filename: 'tests/integration/example.test.ts', tests: [{ id: 'case-one', state: 'passed', retries: 0 }] },
    ],
  },
  coverage: { total: {}, '/src/example.ts': {} },
  runnerSeconds: 100,
  workflowSeconds: 130,
  runId: 1,
})

describe('complete PR change discovery', () => {
  it('retains both rename paths and deletions', () => {
    expect(parseNameStatus('R100\0old.ts\0new.ts\0D\0gone.ts\0')).toEqual({
      changes: [
        { status: 'R', previousPath: 'old.ts', path: 'new.ts' },
        { status: 'D', path: 'gone.ts' },
      ],
    })
  })
  it.each(['', 'M\0../escape.ts\0', 'R100\0old.ts\0', 'X\0unknown.ts\0'])(
    'rejects incomplete or unsafe manifests %s',
    (raw) => {
      expect(() => parseNameStatus(raw)).toThrow()
    },
  )
  it('includes earlier PR commits, not only the latest commit', () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'selection-diff-'))
    const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
    try {
      git('init', '--quiet')
      git('config', 'user.name', 'Fixture')
      git('config', 'user.email', 'fixture@example.invalid')
      writeFileSync(path.join(cwd, 'a.ts'), 'base')
      git('add', 'a.ts')
      git('commit', '--quiet', '--message', 'base')
      const base = git('rev-parse', 'HEAD')
      writeFileSync(path.join(cwd, 'a.ts'), 'first')
      git('add', 'a.ts')
      git('commit', '--quiet', '--message', 'first')
      writeFileSync(path.join(cwd, 'b.ts'), 'second')
      git('add', 'b.ts')
      git('commit', '--quiet', '--message', 'second')
      expect(collectChanges(base, git('rev-parse', 'HEAD'), { cwd }).changes.map(({ path }) => path)).toEqual([
        'a.ts',
        'b.ts',
      ])
      expect(collectChanges('missing', git('rev-parse', 'HEAD'), { cwd }).classificationFailed).toBe(true)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
  it('fails closed for corrupt input and missing rename provenance', () => {
    expect(validateInput({ classificationFailed: true, changes: [] }).valid).toBe(false)
    expect(validateInput({ changes: [{ status: 'R', path: 'new.ts' }] }).valid).toBe(false)
  })
})

describe('measurement acceptance', () => {
  it('requires exact files and successful unretried assertions', () => {
    expect(() => validateRun(receipt())).not.toThrow()
    const invalid = receipt()
    invalid.expectedFiles = ['another.test.ts']
    expect(() => validateRun(invalid)).toThrow('manifest')
  })
  it.each(['failure', 'cancelled', 'incomplete'])('rejects %s', (status) => {
    expect(() => validateRun({ ...receipt(), status })).toThrow()
  })
  it.each(['skipped', 'pending', 'failed'])('rejects case state %s', (state) => {
    const invalid = receipt()
    invalid.report.modules[0]!.tests[0]!.state = state
    expect(() => validateRun(invalid)).toThrow()
  })
  it('rejects unhandled errors, retries and missing coverage', () => {
    const invalid = receipt()
    invalid.report.modules[0]!.tests[0]!.retries = 1
    expect(() => validateRun(invalid)).toThrow()
    expect(() => validateRun({ ...receipt(), coverage: undefined })).toThrow()
    const errors = receipt()
    errors.report.unhandledErrors = 1
    expect(() => validateRun(errors)).toThrow()
  })
  it('distinguishes intentional skip from a missing required report', () => {
    expect(() => validateRun({ status: 'success', mode: 'skip', reasons: ['unaffected'] })).not.toThrow()
    expect(() => validateRun({ status: 'success', mode: 'skip', reasons: [] })).toThrow()
    expect(() => validateRun({ ...receipt(), report: undefined })).toThrow()
  })
  it('accepts a selected subset only when its original case identities match', () => {
    const candidate = { ...receipt('candidate'), runnerSeconds: 70, workflowSeconds: 90, runId: 2 }
    expect(comparePair(receipt(), candidate).runnerSecondsSaved).toBe(30)
    candidate.report.modules[0]!.tests[0]!.id = 'different'
    expect(() => comparePair(receipt(), candidate)).toThrow('identities')
  })
  it('rejects changed sources, coverage scope and topology', () => {
    expect(() => comparePair(receipt(), { ...receipt('candidate'), commit: 'b'.repeat(40) })).toThrow('commit')
    expect(() => comparePair(receipt(), { ...receipt('candidate'), topology: 'four-runners' })).toThrow('topology')
    expect(() => comparePair(receipt(), { ...receipt('candidate'), coverage: { total: {}, '/other.ts': {} } })).toThrow(
      'scope',
    )
  })
  it('keeps slower samples and calculates paired statistics', () => {
    expect(summarize([10, -20])).toEqual({ values: [10, -20], median: -5, min: -20, max: 10 })
  })
  it('counts failed physical jobs but excludes skipped phantom timestamps', () => {
    const jobs = [
      { runner_id: 1, conclusion: 'failure', started_at: '2026-10-07T00:00:00Z', completed_at: '2026-10-07T00:01:00Z' },
      { runner_id: 0, conclusion: 'skipped', started_at: '2026-10-07T00:03:00Z', completed_at: '2026-10-07T00:00:00Z' },
    ]
    expect(physicalRunnerSeconds(jobs)).toBe(60)
  })
})

describe('diagnostic result artifact', () => {
  it.each(['failure', 'cancelled', 'success'])('preserves missing worker evidence for %s', (outcome) => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'selection-final-'))
    try {
      writeFileSync(
        path.join(directory, 'plan.json'),
        JSON.stringify({ topic: 'integration', variant: 'baseline', execution: { mode: 'full' } }),
      )
      const run = spawnSync(process.execPath, ['scripts/ci-selection-poc/finalize.mjs', directory], {
        env: { ...process.env, WORK_RESULT: outcome },
      })
      expect(run.status).toBe(1)
      expect(JSON.parse(readFileSync(path.join(directory, 'result.json'), 'utf8'))).toMatchObject({
        status: 'failure',
        failure: 'Required worker receipt missing',
      })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
