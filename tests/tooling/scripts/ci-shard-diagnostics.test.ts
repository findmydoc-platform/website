import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configSource,
  executePlan,
  makePlan,
  measuredProcess,
  pilotFiles,
  runDiagnostic,
} from '../../../scripts/ci-shard-diagnostics.mjs'
import {
  analyzeRound,
  compareVariants,
  distribution,
  renderSummary,
  validateReports,
} from '../../../scripts/ci-shard-summary.mjs'
import { parse } from 'yaml'

const directories: string[] = []
afterEach(() => {
  vi.unstubAllEnvs()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const report = (filename = 'tests/integration/example.test.ts', id = 'case-1') => ({
  reason: 'passed',
  unhandledErrors: 0,
  hookTimingComplete: true,
  modules: [
    {
      filename,
      durationMs: 10,
      collectMs: 2,
      setupMs: 1,
      prepareMs: 1,
      environmentMs: 0,
      hookMs: 1,
      tests: [{ id, state: 'passed', durationMs: 1, retries: 0 }],
    },
  ],
})
const coverage = (pct = 80) => ({
  total: Object.fromEntries(
    ['lines', 'statements', 'functions', 'branches'].map((category) => [
      category,
      { total: 10, covered: 8, skipped: 0, pct },
    ]),
  ),
  '/runner/src/example.ts': {},
})

describe('integration shard measurement orchestration', () => {
  it('alternates paired run order without running shards concurrently', async () => {
    const calls: string[] = []
    await executePlan(makePlan({ stage: 'full', round: 2 }), async (item: { variant: string; shard: number }) => {
      calls.push(`${item.variant}/${item.shard}`)
      return { code: 0 }
    })
    expect(calls).toEqual(['B/1', 'B/2', 'B/3', 'B/4', 'A/0'])
    expect(makePlan({ stage: 'full', round: 1 }).map((item: { variant: string }) => item.variant)).toEqual([
      'A',
      'B',
      'B',
      'B',
      'B',
    ])
    expect(makePlan({ stage: 'full', variant: 'shard', shard: 3 })).toEqual([{ variant: 'C', shard: 3 }])
  })

  it.each([{ code: 1 }, { code: null, timedOut: true }, { code: null, aborted: true }])(
    'stops after failure and still cleans up: %j',
    async (failure) => {
      const calls: string[] = []
      await expect(
        executePlan(
          makePlan({ stage: 'pilot' }),
          async () => {
            calls.push('run')
            return failure
          },
          {
            before: async () => {
              calls.push('prepare')
            },
            after: async () => {
              calls.push('cleanup')
            },
          },
        ),
      ).rejects.toThrow('subsequent measurements were stopped')
      expect(calls).toEqual(['prepare', 'run', 'cleanup'])
    },
  )

  it('cleans up when preparation throws', async () => {
    let cleaned = false
    await expect(
      executePlan(makePlan(), async () => ({ code: 0 }), {
        before: async () => {
          throw new Error('prepare failed')
        },
        after: async () => {
          cleaned = true
        },
      }),
    ).rejects.toThrow('prepare failed')
    expect(cleaned).toBe(true)
  })

  it('defaults to a plan preview and rejects integration execution outside Actions', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'false')
    expect(await runDiagnostic({ stage: 'full' })).toMatchObject({ dryRun: true })
    await expect(
      runDiagnostic({
        stage: 'full',
        variant: 'pair',
        round: 1,
        shard: 1,
        output: 'tmp/ci-diagnostics/forbidden-local',
        execute: true,
      }),
    ).rejects.toThrow('restricted')
    expect(() => makePlan({ stage: 'full', round: 4 })).toThrow('Invalid round')
    expect(() => makePlan({ stage: 'pilot', variant: 'shard' })).toThrow('require the full stage')
    expect(pilotFiles()).toHaveLength(8)
    expect(new Set(pilotFiles()).size).toBe(8)
  })

  it.each([false, true])('generates valid measurement and merge configs: merge=%s', async (merge) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'ci-shard-config-'))
    directories.push(directory)
    const config = path.join(directory, 'vitest.config.mjs')
    writeFileSync(config, configSource(directory, false, merge))
    const result = await measuredProcess(process.execPath, ['--check', config], { timeoutMs: 5000 })
    expect(result.code).toBe(0)
  })

  it('records exit codes and drains output without storing raw logs', async () => {
    const result = await measuredProcess(
      process.execPath,
      ['-e', 'console.log("measurement-marker"); process.exitCode = 7'],
      { timeoutMs: 5000 },
    )
    expect(result).toMatchObject({ code: 7, timedOut: false, aborted: false })
    expect(result.wallMs).toBeGreaterThan(0)
    expect(JSON.stringify(result)).not.toContain('measurement-marker')
  })

  it('terminates a timed-out process', async () => {
    const result = await measuredProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 100 })
    expect(result).toMatchObject({ timedOut: true, aborted: false })
    expect(result.code).not.toBe(0)
  })

  it('terminates an interrupted process', async () => {
    const controller = new AbortController()
    const pending = measuredProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      signal: controller.signal,
      timeoutMs: 5000,
    })
    controller.abort()
    expect(await pending).toMatchObject({ aborted: true, timedOut: false })
  })

  it('handles an executable that cannot be started', async () => {
    await expect(measuredProcess('nonexistent-ci-shard-diagnostic-command', [], { timeoutMs: 5000 })).rejects.toThrow()
  })

  it('runs the actual reporter through a database-free Vitest process', async () => {
    const output = `tmp/ci-diagnostics/smoke-local-${Date.now()}`
    const directory = path.resolve(output)
    directories.push(directory)
    const result = await runDiagnostic({ stage: 'smoke', variant: 'pair', round: 1, shard: 1, output, execute: true })
    expect(result.valid).toBe(true)
    const metrics = JSON.parse(readFileSync(path.join(directory, 'smoke-0/metrics.json'), 'utf8'))
    const selection = validateReports([metrics])
    expect(selection.tests).toHaveLength(1)
    expect(metrics.hookTimingComplete).toBe(true)
    expect(metrics.modules[0].hookMsByName.beforeAll).toBeGreaterThanOrEqual(50)
    expect(JSON.stringify(metrics)).not.toContain('reporter smoke')
  }, 20000)
})

describe('integration shard comparison validity', () => {
  it('accepts an identical file and case selection split across reports', () => {
    const first = report('tests/integration/a.test.ts', 'a')
    const second = report('tests/integration/b.test.ts', 'b')
    const baseline = { ...first, modules: [...first.modules, ...second.modules] }
    expect(compareVariants([baseline], [first, second], coverage(), coverage()).tests).toEqual(['a', 'b'])
  })

  it('rejects duplicated files, duplicated cases, and empty reports', () => {
    expect(() => validateReports([report(), report()])).toThrow('file')
    expect(() => validateReports([report('a'), report('b')])).toThrow('case')
    expect(() =>
      validateReports([{ reason: 'passed', unhandledErrors: 0, hookTimingComplete: true, modules: [] }]),
    ).toThrow('empty')
  })

  it('rejects missing tests and unequal coverage', () => {
    expect(() => compareVariants([report()], [report('different')], coverage(), coverage())).toThrow('selection')
    const different = coverage()
    different.total.lines!.covered = 7
    expect(() => compareVariants([report()], [report()], coverage(), different)).toThrow('totals')
    expect(() => compareVariants([report()], [report()], coverage(40), coverage(40))).toThrow('threshold')
    expect(() => compareVariants([report()], [report()], coverage(40), coverage(40), false)).not.toThrow()
  })

  it.each(['failed', 'skipped'])('rejects %s cases', (state) => {
    const failed = report()
    failed.modules[0]!.tests[0]!.state = state
    expect(() => validateReports([failed])).toThrow('failed')
  })

  it('rejects retried and unhandled failures', () => {
    const retried = report()
    retried.modules[0]!.tests[0]!.retries = 1
    expect(() => validateReports([retried])).toThrow('retry')
    expect(() => validateReports([{ ...report(), unhandledErrors: 1 }])).toThrow('unsuccessful')
    expect(() => validateReports([{ ...report(), hookTimingComplete: false }])).toThrow('incomplete')
  })

  it('calculates medians and spread without silently accepting missing values', () => {
    expect(distribution([300, 100, 200])).toEqual({ median: 200, min: 100, max: 300 })
    expect(distribution([100, 200])).toEqual({ median: 150, min: 100, max: 200 })
    expect(() => distribution([])).toThrow()
    expect(() => distribution([Number.NaN])).toThrow()
  })

  it('loads complete native-merge artifacts and rejects a missing shard', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'ci-shard-fixture-'))
    directories.push(directory)
    const write = (filename: string, data: unknown) => {
      const target = path.join(directory, filename)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, JSON.stringify(data))
    }
    const modules = [1, 2, 3, 4].map((shard) => report(`tests/integration/${shard}.test.ts`, `case-${shard}`))
    const processRecord = {
      code: 0,
      timedOut: false,
      aborted: false,
      startedAt: '2026-10-05T00:00:00Z',
      endedAt: '2026-10-05T00:00:01Z',
      wallMs: 1000,
      phases: [],
    }
    const results = [
      { ...processRecord, variant: 'A', shard: 0 },
      ...[1, 2, 3, 4].map((shard) => ({ ...processRecord, variant: 'B', shard })),
    ]
    write('pair/run.json', {
      valid: true,
      stage: 'pilot',
      round: 1,
      commit: 'fixed',
      sourceFingerprint: 'same',
      node: 'v24',
      results,
    })
    write('pair/A-0/metrics.json', { ...modules[0], modules: modules.flatMap((item) => item.modules) })
    write('pair/A-0/coverage/coverage-summary.json', coverage())
    for (let shard = 1; shard <= 4; shard++) write(`pair/B-${shard}/metrics.json`, modules[shard - 1])
    write('pair/B-merged/process.json', processRecord)
    write('pair/B-merged/coverage/coverage-summary.json', coverage())
    const result = analyzeRound(directory)
    expect(result.selection?.tests).toHaveLength(4)
    expect(result.variants).toMatchObject({ B: { processMs: 5000 } })
    expect(renderSummary([result])).toContain('Matched files: 4')
    expect(() => renderSummary([result, result])).toThrow('more than once')
    write('pair/run.json', {
      valid: true,
      stage: 'pilot',
      round: 1,
      commit: 'fixed',
      sourceFingerprint: 'same',
      node: 'v24',
      results: results.slice(0, -1),
    })
    expect(() => analyzeRound(directory)).toThrow('Every required shard')
  })

  it('limits the real workflow to the diagnostic branch and gates C on a successful pair', () => {
    const workflow = parse(readFileSync('.github/workflows/ci-shard-diagnostics.yml', 'utf8'))
    expect(workflow.on.push.branches).toEqual(['agent/ci-shard-diagnostics'])
    expect(workflow.on.pull_request).toBeUndefined()
    expect(workflow.on.schedule).toBeUndefined()
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.concurrency['cancel-in-progress']).toBe(false)
    expect(workflow.jobs.pair.if).toContain("github.ref == 'refs/heads/agent/ci-shard-diagnostics'")
    expect(workflow.jobs.shards.needs).toBe('pair')
    expect(workflow.jobs.shards.if).toContain("inputs.stage == 'full'")
    expect(workflow.jobs.summary.if).toContain("needs.pair.result == 'success'")
  })
})
