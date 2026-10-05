import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import {
  configSource,
  executePlan,
  makePlan,
  measuredProcess,
  runDiagnostic,
} from '../../../scripts/ci-shard-diagnostics.mjs'
import { hookFiles, hookTestCounts, validateHookMeasurement } from '../../../scripts/ci-shard-hook-validation.mjs'
import { analyzeHookRounds, readPhaseEvents, renderHookSummary } from '../../../scripts/ci-shard-hook-summary.mjs'

const seeds = vi.hoisted(() => vi.fn(async () => ({ units: [], failures: [], warnings: [] })))
vi.mock('@/endpoints/seed/baseline', () => ({ runBaselineSeeds: seeds }))
const directories: string[] = []
const temporary = () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ci-hook-'))
  directories.push(directory)
  return directory
}
beforeEach(() => {
  vi.resetModules()
  seeds.mockClear()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('beforeAll measurement behavior', () => {
  it('preserves the disabled callback result and existing baseline cache', async () => {
    vi.stubEnv('CI_SHARD_PHASES', '')
    const { measureHookPhase } = await import('../../../scripts/ci-shard-hook-phases.mjs')
    const { ensureBaseline } = await import('../../fixtures/ensureBaseline')
    const value = { identity: true }
    expect(measureHookPhase(hookFiles()[0], 'payload-init', () => value)).toBe(value)
    await ensureBaseline({} as never)
    await ensureBaseline({} as never)
    expect(seeds).toHaveBeenCalledTimes(1)
  })

  it('records real seed work and a subsequent cache hit without repeating seeding', async () => {
    const output = path.join(temporary(), 'phases.jsonl')
    vi.stubEnv('CI_SHARD_PHASES', output)
    const { measureHookPhase } = await import('../../../scripts/ci-shard-hook-phases.mjs')
    const { ensureBaseline } = await import('../../fixtures/ensureBaseline')
    await measureHookPhase(hookFiles()[0], 'baseline-check', () => ensureBaseline({} as never))
    await measureHookPhase(hookFiles()[1], 'baseline-check', () => ensureBaseline({} as never))
    const events = readPhaseEvents(output)
    expect(events.map((event: { phase: string }) => event.phase)).toEqual([
      'baseline-seed',
      'baseline-check',
      'baseline-cache',
      'baseline-check',
    ])
    expect(events[0].filename).toBe(hookFiles()[0])
    expect(events[2]).toMatchObject({ filename: hookFiles()[1], durationMs: 0, status: 'passed' })
    expect(events[0].durationMs).toBeLessThanOrEqual(events[1].durationMs)
    expect(seeds).toHaveBeenCalledTimes(1)
  })

  it('propagates the original failure and leaves baseline eligible for a retry', async () => {
    const output = path.join(temporary(), 'phases.jsonl')
    vi.stubEnv('CI_SHARD_PHASES', output)
    const { measureHookPhase } = await import('../../../scripts/ci-shard-hook-phases.mjs')
    const { ensureBaseline } = await import('../../fixtures/ensureBaseline')
    const failure = new Error('synthetic private failure text')
    seeds.mockRejectedValueOnce(failure)
    await expect(measureHookPhase(hookFiles()[0], 'baseline-check', () => ensureBaseline({} as never))).rejects.toBe(
      failure,
    )
    await measureHookPhase(hookFiles()[0], 'baseline-check', () => ensureBaseline({} as never))
    expect(seeds).toHaveBeenCalledTimes(2)
    expect(readPhaseEvents(output).map((event: { status: string }) => event.status)).toEqual([
      'failed',
      'failed',
      'passed',
      'passed',
    ])
    expect(readFileSync(output, 'utf8')).not.toContain(failure.message)
  })

  it('uses captured clocks when tests replace performance and hrtime', async () => {
    const output = path.join(temporary(), 'phases.jsonl')
    vi.stubEnv('CI_SHARD_PHASES', output)
    const { measureHookPhase } = await import('../../../scripts/ci-shard-hook-phases.mjs')
    vi.useFakeTimers({ toFake: ['performance', 'hrtime'] })
    vi.spyOn(process.hrtime, 'bigint').mockReturnValue(0n)
    await measureHookPhase(hookFiles()[0], 'payload-init', () => new Promise((resolve) => setTimeout(resolve, 30)))
    const [event] = readPhaseEvents(output)
    expect(event.durationMs).toBeGreaterThanOrEqual(20)
    expect(event.durationMs).toBeLessThan(1000)
  })
})

const makeMetrics = (round: number) => ({
  reason: 'passed',
  unhandledErrors: 0,
  hookTimingComplete: true,
  modules: hookFiles(round).map((filename) => ({
    filename,
    hookMsByName: { beforeAll: 70 },
    tests: Array.from({ length: hookTestCounts[filename]! }, (_, index) => ({
      id: `${filename}:${index}`,
      state: 'passed',
      retries: 0,
    })),
  })),
})
const makeEvents = (round: number) =>
  hookFiles(round).flatMap((filename) => [
    { filename, phase: 'payload-init', durationMs: 40, status: 'passed' },
    { filename, phase: 'baseline-seed', durationMs: 15, status: 'passed' },
    { filename, phase: 'baseline-check', durationMs: 20, status: 'passed' },
    { filename, phase: 'fixtures', durationMs: 5, status: 'passed' },
  ])

describe('hook diagnostic execution and acceptance', () => {
  it('previews the rotated file selection and rejects local integration execution', async () => {
    expect(makePlan({ stage: 'hooks' })).toEqual([{ variant: 'H', shard: 0 }])
    expect(hookFiles(2)).toEqual([hookFiles()[1], hookFiles()[2], hookFiles()[0]])
    expect(hookFiles(3)).toEqual([hookFiles()[2], hookFiles()[0], hookFiles()[1]])
    expect(await runDiagnostic({ stage: 'hooks', round: 2 })).toMatchObject({ files: hookFiles(2), dryRun: true })
    vi.stubEnv('GITHUB_ACTIONS', 'false')
    await expect(
      runDiagnostic({
        stage: 'hooks',
        round: 1,
        variant: 'pair',
        shard: 1,
        execute: true,
        output: 'tmp/ci-diagnostics/hooks-forbidden',
      }),
    ).rejects.toThrow('restricted')
    expect(() => makePlan({ stage: 'hooks', variant: 'shard' })).toThrow('single serial process')
  })

  it('does not double-count nested seed work in the beforeAll residual', () => {
    const files = validateHookMeasurement(makeMetrics(1), makeEvents(1), hookFiles(1))
    expect(files[0]).toMatchObject({ hookMs: 70, residualMs: 5, seedMs: 15, seedCalls: 1, cacheHits: 0 })
    const cached = makeEvents(1).map((event) =>
      event.phase === 'baseline-seed' ? { ...event, phase: 'baseline-cache', durationMs: 0 } : event,
    )
    expect(validateHookMeasurement(makeMetrics(1), cached, hookFiles(1))[0]).toMatchObject({
      seedMs: 0,
      seedCalls: 0,
      cacheHits: 1,
      residualMs: 5,
    })
  })

  it('rejects incomplete, negative, duplicated or out-of-order measurements before another process starts', async () => {
    const invalid = [
      makeEvents(1).slice(1),
      [...makeEvents(1), makeEvents(1)[0]],
      makeEvents(1).map((event, index) => (index === 0 ? { ...event, durationMs: -1 } : event)),
    ]
    for (const events of invalid) expect(() => validateHookMeasurement(makeMetrics(1), events, hookFiles(1))).toThrow()
    expect(() => validateHookMeasurement(makeMetrics(2), makeEvents(2), hookFiles(1))).toThrow('order')
    const failed = makeMetrics(1)
    failed.modules[0]!.tests[0]!.retries = 1
    expect(() => validateHookMeasurement(failed, makeEvents(1), hookFiles(1))).toThrow('37')
    const calls: string[] = []
    await expect(
      executePlan(
        [1, 2, 3],
        async (round: number) => {
          calls.push(`run-${round}`)
          validateHookMeasurement(makeMetrics(round), [], hookFiles(round))
          return { code: 0 }
        },
        {
          after: async () => {
            calls.push('cleanup')
          },
        },
      ),
    ).rejects.toThrow('required exactly once')
    expect(calls).toEqual(['run-1', 'cleanup'])
  })

  it('applies rotated ordering in a real Vitest process without a database', async () => {
    const output = `tmp/ci-diagnostics/hook-sequencer-${Date.now()}`
    const directory = path.resolve(output)
    directories.push(directory)
    mkdirSync(directory, { recursive: true })
    const files = ['a', 'b', 'c'].map((name) => `${output}/${name}.test.ts`)
    for (const filename of files)
      writeFileSync(filename, "import { it, expect } from 'vitest'; it('works', () => expect(1 + 1).toBe(2))")
    const order = [files[1], files[2], files[0]]
    const config = path.join(directory, 'vitest.config.mjs')
    writeFileSync(
      config,
      `import HookSequencer from ${JSON.stringify(path.resolve('scripts/ci-shard-hook-sequencer.mjs'))}; export default { test: { include: ${JSON.stringify(files)}, fileParallelism: false, sequence: { sequencer: HookSequencer }, runner: ${JSON.stringify(path.resolve('scripts/ci-shard-worker.mjs'))}, reporters: [${JSON.stringify(path.resolve('scripts/ci-shard-reporter.mjs'))}] } }`,
    )
    const lines: string[] = []
    const result = await measuredProcess(
      process.execPath,
      [path.resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', config],
      {
        timeoutMs: 15000,
        onLine: (line: string) => lines.push(line),
        env: {
          ...process.env,
          CI_SHARD_FILE_ORDER: JSON.stringify(order),
          CI_SHARD_REPORT: path.join(directory, 'metrics.json'),
          CI_SHARD_HOOKS: path.join(directory, 'hooks.jsonl'),
        },
      },
    )
    expect(result.code, lines.join('\n')).toBe(0)
    expect(
      JSON.parse(readFileSync(path.join(directory, 'metrics.json'), 'utf8')).modules.map(
        (item: { filename: string }) => item.filename,
      ),
    ).toEqual(order)
    const generated = path.join(directory, 'hooks.config.mjs')
    writeFileSync(generated, configSource(directory, false, false, 2))
    expect((await measuredProcess(process.execPath, ['--check', generated], { timeoutMs: 5000 })).code).toBe(0)
  }, 20000)

  it('checks equivalent cases and coverage after each repetition and requires three for final reporting', () => {
    const directory = temporary()
    const write = (filename: string, data: unknown) => {
      const target = path.join(directory, filename)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, JSON.stringify(data))
    }
    const coverage = {
      total: Object.fromEntries(
        ['lines', 'statements', 'functions', 'branches'].map((name) => [
          name,
          { total: 10, covered: 8, skipped: 0, pct: 80 },
        ]),
      ),
      '/runner/src/example.ts': {},
    }
    for (const round of [1, 2, 3]) {
      write(`round-${round}/run.json`, {
        valid: true,
        stage: 'hooks',
        round,
        commit: 'frozen',
        sourceFingerprint: 'same',
        node: 'v24',
        cpus: ['model'],
        totalMemoryBytes: 1000,
        results: [{ variant: 'H', shard: 0, code: 0, wallMs: 100 }],
      })
      write(`round-${round}/H-0/metrics.json`, makeMetrics(round))
      write(`round-${round}/H-0/coverage/coverage-summary.json`, coverage)
      writeFileSync(
        path.join(directory, `round-${round}/H-0/phases.jsonl`),
        makeEvents(round)
          .map((event) => JSON.stringify(event))
          .join('\n'),
      )
      expect(analyzeHookRounds(directory, true)).toHaveLength(round)
      if (round !== 3) expect(() => analyzeHookRounds(directory)).toThrow('Three complete')
    }
    const rounds = analyzeHookRounds(directory)
    expect(rounds[0].selection.tests).toHaveLength(37)
    expect(renderHookSummary(rounds)).toContain('Residual, s')
    const changed = structuredClone(coverage)
    changed.total.lines!.covered = 7
    write('round-2/H-0/coverage/coverage-summary.json', changed)
    expect(() => analyzeHookRounds(directory, true)).toThrow('Coverage totals')
  })

  it('keeps hook measurements manual and validates each repetition before starting the next', () => {
    const workflow = parse(readFileSync('.github/workflows/ci-shard-diagnostics.yml', 'utf8'))
    expect(workflow.jobs.hooks.if).toContain("inputs.stage == 'hooks'")
    expect(workflow.jobs.hooks.if).toContain("github.ref == 'refs/heads/agent/ci-shard-diagnostics'")
    expect(workflow.jobs.hooks['timeout-minutes']).toBe(60)
    const step = workflow.jobs.hooks.steps.find(
      (item: { name: string }) => item.name === 'Measure three serial repetitions',
    )
    expect(step.run).toContain('set -euo pipefail')
    expect(step.run).toContain('for diagnostic_round in 1 2 3')
    expect(step.run).toContain('--partial')
    expect(workflow.on.push.branches).toEqual(['agent/ci-shard-diagnostics'])
    expect(workflow.permissions).toEqual({ contents: 'read' })
  })
})
