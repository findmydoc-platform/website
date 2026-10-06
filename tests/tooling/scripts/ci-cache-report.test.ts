import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import {
  cacheIdentity,
  median,
  summarize,
  validateCacheReceipt,
  validateMeasurement,
  validateSupplementaryMeasurements,
} from '../../../scripts/ci-cache-report.mjs'

const commit = 'a'.repeat(40)
const sample = (variant = 'warm', round = 1) => ({
  schemaVersion: 1,
  kind: 'pnpm',
  variant,
  round,
  commit,
  node: '24.14.0',
  pnpm: '10.28.2',
  success: true,
  cleanupSucceeded: true,
  phases: [{ name: 'install', durationMs: 1000, exitCode: 0 }],
  packages: { resolved: 10, reused: variant === 'warm' ? 10 : 0, downloaded: variant === 'warm' ? 0 : 10, added: 10 },
  jobId: `pnpm ${variant} r${round}`,
  cache: {
    attempted: variant !== 'baseline',
    state: variant === 'warm' ? 'exact' : variant === 'baseline' ? 'disabled' : 'miss',
    saveOutcome: variant === 'populate' ? 'success' : 'skipped',
  },
})

describe('cache experiment evidence gates', () => {
  it('rejects restored stores without package reuse and preserves failed process evidence', () => {
    expect(() => validateMeasurement({ ...sample(), packages: { ...sample().packages, reused: 0 } })).toThrow('reuse')
    expect(() =>
      validateMeasurement({ ...sample(), phases: [{ name: 'install', durationMs: 4, exitCode: 1 }] }),
    ).toThrow('phase')
    expect(() => validateMeasurement({ ...sample(), cleanupSucceeded: false })).toThrow('cleanup')
  })

  it('distinguishes exact hits, fallback restores and misses', () => {
    expect(validateCacheReceipt(sample(), sample().cache).state).toBe('exact')
    expect(
      validateCacheReceipt({ ...sample(), variant: 'warm-fallback' }, { ...sample().cache, state: 'fallback' }).state,
    ).toBe('fallback')
    expect(
      validateCacheReceipt(sample('lock-change'), { attempted: true, state: 'miss', saveOutcome: 'skipped' }).state,
    ).toBe('miss')
    expect(() => validateCacheReceipt(sample(), { ...sample().cache, state: 'fallback' })).toThrow('exact')
    expect(() =>
      validateCacheReceipt(sample('populate'), { ...sample('populate').cache, saveOutcome: 'failure' }),
    ).toThrow('saved')
  })

  it('does not treat successful compiler builds without reused modules as warm results', () => {
    const compiler = {
      ...sample(),
      kind: 'compiler',
      builds: [{ exitCode: 0, compilers: [{ cachedModules: 0 }], sourceMarkerVerified: true }],
    }
    expect(() => validateMeasurement(compiler)).toThrow('reuse')
    expect(() =>
      validateMeasurement({
        ...compiler,
        variant: 'incremental',
        builds: [{ exitCode: 0, compilers: [{ cachedModules: 2 }], sourceMarkerVerified: false }],
      }),
    ).toThrow('source')
  })

  it('rejects failed builds even when their restore and reuse counters look successful', () => {
    expect(() =>
      validateMeasurement({
        ...sample(),
        kind: 'compiler',
        builds: [{ exitCode: 1, compilers: [{ cachedModules: 10 }] }],
      }),
    ).toThrow('successful instrumented build')
  })

  it('requires every fallback, invalidation and source-change repetition before combination', () => {
    const results = [1, 2, 3].flatMap((round) =>
      ['warm-fallback', 'lock-change', 'incremental'].map((variant) => ({
        ...sample(variant, round),
        kind: variant === 'incremental' ? 'compiler' : 'pnpm',
        jobId: `${variant} r${round}`,
        packages: { resolved: 10, reused: variant === 'warm-fallback' ? 10 : 0, downloaded: 0, added: 10 },
        builds: [{ exitCode: 0, compilers: [{ cachedModules: 10 }], sourceMarkerVerified: true }],
        cache: {
          attempted: true,
          state: variant === 'lock-change' ? 'miss' : 'fallback',
          saveOutcome: variant === 'incremental' ? 'success' : 'skipped',
        },
      })),
    )
    const jobs = results.map((r) => ({ id: r.jobId, conclusion: 'success', completedAt: '2026-10-06T00:01:00Z' }))
    expect(() => validateSupplementaryMeasurements(results, jobs)).not.toThrow()
    expect(() => validateSupplementaryMeasurements(results.slice(1), jobs)).toThrow('Missing')
    expect(() =>
      validateSupplementaryMeasurements(results, [{ ...jobs[0], conclusion: 'failure' }, ...jobs.slice(1)]),
    ).toThrow('supplementary job')
  })

  it.each(['combined-seed', 'combined-restore'])('retains original failed measurement evidence in %s', (job) => {
    const workflow = parse(
      readFileSync(new URL('../../../.github/workflows/ci-cache-diagnostics.yml', import.meta.url), 'utf8'),
    ) as {
      jobs: Record<string, { steps: Array<{ uses?: string; if?: string; with?: { path?: string } }> }>
    }
    const upload = workflow.jobs[job]?.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'))
    expect(upload?.if).toBe('always()')
    expect(
      upload?.with?.path
        ?.trim()
        .split('\n')
        .map((line) => line.trim()),
    ).toEqual(['tmp/ci-cache/pnpm/**/*.json', 'tmp/ci-cache/compiler/**/*.json', 'tmp/ci-cache/combined/**/*.json'])
  })

  it('invalidates lockfile and tool changes without tying cache identity to a workflow run', () => {
    const inputs = {
      experiment: 'cache-v1',
      commit,
      round: 1,
      kind: 'pnpm',
      lock: 'first',
      config: 'config',
      node: '24.14.0',
      pnpm: '10.28.2',
      os: 'linux',
      arch: 'x64',
    }
    const key = cacheIdentity(inputs)
    expect(cacheIdentity(inputs)).toBe(key)
    expect(cacheIdentity({ ...inputs, lock: 'changed' })).not.toBe(key)
    expect(cacheIdentity({ ...inputs, pnpm: '10.29.0' })).not.toBe(key)
    expect(() => cacheIdentity({ ...inputs, experiment: '../invalid' })).toThrow('identifier')
  })

  it('uses complete runner times and rejects incomplete repetitions or differing commits', () => {
    const results = [1, 2, 3].flatMap((round) =>
      ['baseline', 'populate', 'warm'].map((variant) => sample(variant, round)),
    )
    const jobs = results.map((r) => ({
      id: `Cache diagnostics / ${r.jobId}`,
      startedAt: '2026-10-06T00:00:00Z',
      completedAt: r.variant === 'warm' ? '2026-10-06T00:00:40Z' : '2026-10-06T00:01:00Z',
      conclusion: 'success',
    }))
    expect(summarize(results, jobs, 'pnpm').medianSavedMs).toBe(20000)
    expect(() => summarize(results.slice(1), jobs, 'pnpm')).toThrow('Missing')
    expect(() => summarize([{ ...results[0], commit: 'b'.repeat(40) }, ...results.slice(1)], jobs, 'pnpm')).toThrow(
      'inputs',
    )
    expect(median([100, -2, 3])).toBe(3)
  })
})
