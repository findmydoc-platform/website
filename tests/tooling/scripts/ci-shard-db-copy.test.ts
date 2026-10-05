import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  analyzeCopyRounds,
  renderCopySummary,
  validateCopyCoverage,
} from '../../../scripts/ci-shard-db-copy-summary.mjs'
import { copyFiles, validateCopySelection } from '../../../scripts/ci-shard-db-copy-selection.mjs'
import counts from '../../../scripts/ci-shard-db-copy-selection.json'
import { parse } from 'yaml'
import { hookFiles, hookTestCounts } from '../../../scripts/ci-shard-hook-validation.mjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makePlan,
  runDiagnostic,
  prepareSeedConfig,
  mergeSeedCoverage,
  measuredProcess,
} from '../../../scripts/ci-shard-diagnostics.mjs'
import {
  assertBaselineWorkingDatabase,
  computeTestDatabaseFingerprint,
  copyBaselineWorkingDatabase,
  verifyBaselineCopyIsolation,
} from '../../../scripts/test-database-harness.mjs'

const database = vi.hoisted(() => ({ query: vi.fn(), end: vi.fn(), connect: vi.fn() }))
const seeds = vi.hoisted(() => vi.fn(async () => ({ units: [], failures: [], warnings: [] })))
vi.mock('pg', () => ({
  default: {
    Client: class {
      connect = database.connect
      query = database.query
      end = database.end
    },
  },
}))
vi.mock('@/endpoints/seed/baseline', () => ({ runBaselineSeeds: seeds }))

beforeEach(() => {
  vi.resetModules()
  seeds.mockClear()
  database.query.mockReset()
  database.end.mockResolvedValue(undefined)
  database.connect.mockResolvedValue(undefined)
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('CI_DB_COPY', '1')
  vi.stubEnv('CI_SHARD_PHASES', '')
  vi.stubEnv('DATABASE_URI', 'postgresql://localhost/findmydoc-test-copy')
  database.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT template_kind'))
      return {
        rows: [
          { template_kind: 'baseline', fingerprint: computeTestDatabaseFingerprint({ templateKind: 'baseline' }) },
        ],
      }
    return { rowCount: 1, rows: [] }
  })
})
afterEach(() => vi.unstubAllEnvs())

// Protects destructive database routing and the seed bypass against stale or missing templates.
describe('baseline copy experiment', () => {
  it('copies only the working database from a verified template and verifies its copied metadata', async () => {
    await copyBaselineWorkingDatabase()
    const queries = database.query.mock.calls.map(([sql]) => sql)
    expect(queries.filter((sql) => sql.startsWith('DROP DATABASE'))).toEqual(['DROP DATABASE "findmydoc-test-copy"'])
    expect(queries).toContain(
      'CREATE DATABASE "findmydoc-test-copy" WITH TEMPLATE "findmydoc-test-copy_template_baseline"',
    )
    expect(queries.filter((sql) => sql.startsWith('SELECT template_kind'))).toHaveLength(2)
    expect(database.end).toHaveBeenCalled()
  })

  it.each([null, { template_kind: 'empty', fingerprint: 'old' }, { template_kind: 'baseline', fingerprint: 'old' }])(
    'rejects invalid template metadata before any destructive SQL',
    async (metadata) => {
      database.query.mockResolvedValue({ rows: metadata ? [metadata] : [] })
      await expect(copyBaselineWorkingDatabase()).rejects.toThrow('missing or stale')
      expect(database.query.mock.calls.some(([sql]) => /DROP|CREATE|ALTER/.test(sql))).toBe(false)
    },
  )

  it('rejects a clone whose metadata does not match the verified template', async () => {
    let reads = 0
    database.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT template_kind')) {
        reads += 1
        return {
          rows: [
            {
              template_kind: 'baseline',
              fingerprint: reads === 1 ? computeTestDatabaseFingerprint({ templateKind: 'baseline' }) : 'wrong',
            },
          ],
        }
      }
      return { rowCount: 1, rows: [] }
    })
    await expect(copyBaselineWorkingDatabase()).rejects.toThrow('not a current baseline copy')
  })

  it.each(['postgresql://localhost/production', 'postgresql://remote.example/findmydoc-test-copy'])(
    'rejects unsafe database targets without connecting',
    async (uri) => {
      vi.stubEnv('DATABASE_URI', uri)
      database.connect.mockClear()
      await expect(copyBaselineWorkingDatabase()).rejects.toThrow('Refusing destructive')
      expect(database.connect).not.toHaveBeenCalled()
    },
  )

  it('requires explicit test mode before database access', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    database.connect.mockClear()
    await expect(copyBaselineWorkingDatabase()).rejects.toThrow('explicit test experiment')
    await expect(assertBaselineWorkingDatabase()).rejects.toThrow('explicit test experiment')
    expect(database.connect).not.toHaveBeenCalled()
  })

  it('skips seeding only after verification and propagates failed verification', async () => {
    const { ensureBaseline } = await import('../../fixtures/ensureBaseline')
    await ensureBaseline({} as never)
    expect(seeds).not.toHaveBeenCalled()
    vi.resetModules()
    database.query.mockResolvedValue({ rows: [] })
    const fresh = await import('../../fixtures/ensureBaseline')
    await expect(fresh.ensureBaseline({} as never)).rejects.toThrow('not a current baseline copy')
    expect(seeds).not.toHaveBeenCalled()
  })

  it('keeps regular seeding when the experiment is disabled', async () => {
    vi.stubEnv('CI_DB_COPY', '')
    const { ensureBaseline } = await import('../../fixtures/ensureBaseline')
    await ensureBaseline({} as never)
    expect(seeds).toHaveBeenCalledTimes(1)
  })

  it('alternates paired order and previews the same rotated sample', async () => {
    expect(makePlan({ stage: 'db-copy', round: 1 })).toEqual([
      { variant: 'D', shard: 0 },
      { variant: 'E', shard: 0 },
    ])
    expect(makePlan({ stage: 'db-copy', round: 2 })).toEqual([
      { variant: 'E', shard: 0 },
      { variant: 'D', shard: 0 },
    ])
    expect(() => makePlan({ stage: 'db-copy', variant: 'shard' })).toThrow('paired serial')
    expect(await runDiagnostic({ stage: 'db-copy', round: 1 })).toMatchObject({
      dryRun: true,
      files: expect.any(Array),
    })
  })
})

it('validates matched pairs, includes preparation and cleanup, and exposes coverage differences', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'db-copy-summary-'))
  const write = (filename: string, data: unknown) => {
    const target = path.join(directory, filename)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, JSON.stringify(data))
  }
  try {
    for (const round of [1, 2, 3]) {
      const order = round === 2 ? ['E', 'D'] : ['D', 'E']
      write(`round-${round}/run.json`, {
        valid: true,
        stage: 'db-copy',
        round,
        commit: 'frozen',
        sourceFingerprint: 'same',
        node: 'v24',
        cpus: ['model'],
        totalMemoryBytes: 1000,
        results: order.map((variant) => ({
          variant,
          shard: 0,
          code: 0,
          wallMs: variant === 'D' ? 1000 : 700,
          cleanupMs: 100,
        })),
      })
      for (const variant of order) {
        const base = `round-${round}/${variant}-0`
        const files = hookFiles(round)
        write(`${base}/metrics.json`, {
          reason: 'passed',
          unhandledErrors: 0,
          hookTimingComplete: true,
          modules: files.map((filename) => ({
            filename,
            hookMsByName: { beforeAll: 70 },
            tests: Array.from({ length: hookTestCounts[filename]! }, (_, index) => ({
              id: `${filename}:${index}`,
              state: 'passed',
              retries: 0,
            })),
          })),
        })
        write(`${base}/coverage/coverage-summary.json`, {
          total: Object.fromEntries(
            ['lines', 'statements', 'functions', 'branches'].map((name) => [
              name,
              { total: 10, covered: variant === 'D' ? 8 : 6, skipped: 0, pct: variant === 'D' ? 80 : 60 },
            ]),
          ),
          '/runner/src/example.ts': {},
        })
        const events = files.flatMap((filename) => [
          { filename, phase: 'payload-init', durationMs: 20, status: 'passed' },
          {
            filename,
            phase: variant === 'D' ? 'baseline-seed' : 'baseline-cache',
            durationMs: variant === 'D' ? 15 : 0,
            status: 'passed',
          },
          { filename, phase: 'baseline-check', durationMs: 20, status: 'passed' },
          { filename, phase: 'fixtures', durationMs: 5, status: 'passed' },
        ])
        writeFileSync(
          path.join(directory, base, 'phases.jsonl'),
          events.map((event) => JSON.stringify(event)).join('\n'),
        )
        if (variant === 'E')
          writeFileSync(
            path.join(directory, base, 'copies.jsonl'),
            [1, 2, 3].map(() => JSON.stringify({ durationMs: 30, status: 'passed' })).join('\n'),
          )
      }
      expect(analyzeCopyRounds(directory, true)).toHaveLength(round)
      if (round < 3) expect(() => analyzeCopyRounds(directory)).toThrow('consecutive')
    }
    const rounds = analyzeCopyRounds(directory)
    expect(rounds[0].variants.D.totalMs).toBe(1100)
    expect(rounds[0].variants.E.totalMs).toBe(800)
    expect(rounds[0].variants.E.copyMs).toBe(90)
    expect(rounds[0].savedMs).toBe(300)
    expect(renderCopySummary(rounds)).toContain('0.300 seconds')
    expect(renderCopySummary(rounds)).toContain('8 / 10 | 6 / 10')
    writeFileSync(path.join(directory, 'round-2/E-0/copies.jsonl'), '')
    expect(() => analyzeCopyRounds(directory)).toThrow('Three successful')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('expanded serial comparison acceptance', () => {
  it('requires every manifest file and case, with matched deterministic ordering', () => {
    const files = copyFiles('db-copy-suite', 1)
    expect(files).toHaveLength(98)
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(877)
    expect(copyFiles('db-copy-mixed', 1)).toHaveLength(12)
    expect(copyFiles('db-copy-mixed', 2)).toEqual(copyFiles('db-copy-mixed', 1).reverse())
    const metrics = {
      modules: files.map((filename) => ({
        filename,
        tests: Array.from({ length: counts[filename as keyof typeof counts] }),
      })),
    }
    expect(validateCopySelection(metrics, 'db-copy-suite', 1)).toEqual(files)
    metrics.modules[0]!.tests.pop()
    expect(() => validateCopySelection(metrics, 'db-copy-suite', 1)).toThrow('case counts')
  })

  it('rejects coverage loss and retains existing full-suite thresholds', () => {
    const report = (covered: number) => ({
      total: Object.fromEntries(
        ['lines', 'statements', 'functions', 'branches'].map((name) => [
          name,
          { total: 100, covered, skipped: 0, pct: covered },
        ]),
      ),
      '/runner/src/example.ts': {},
    })
    expect(() => validateCopyCoverage(report(80), report(81), true)).not.toThrow()
    expect(() => validateCopyCoverage(report(80), report(79))).toThrow('regresses')
    expect(() => validateCopyCoverage(report(40), report(40), true)).toThrow('threshold')
  })

  it('detects leaked SQL state before writing a new isolation marker', async () => {
    await verifyBaselineCopyIsolation()
    expect(database.query.mock.calls.map(([sql]) => sql)).toContain(
      'INSERT INTO public.codex_copy_isolation_probe VALUES (1)',
    )
    database.query.mockClear()
    database.query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith('SELECT template_kind')
        ? [{ template_kind: 'baseline', fingerprint: computeTestDatabaseFingerprint({ templateKind: 'baseline' }) }]
        : [{ probe: 'codex_copy_isolation_probe' }],
    }))
    await expect(verifyBaselineCopyIsolation()).rejects.toThrow('leaked SQL state')
    expect(database.query.mock.calls.some(([sql]) => sql.startsWith('CREATE TABLE'))).toBe(false)
  })

  it('gates full-suite execution on the mixed comparison with no parallel test jobs', () => {
    const workflow = parse(readFileSync('.github/workflows/ci-shard-diagnostics.yml', 'utf8'))
    expect(workflow.jobs['db-copy-suite'].needs).toBe('db-copy-mixed')
    expect(workflow.jobs['db-copy-suite'].if).toContain("needs.db-copy-mixed.result == 'success'")
    expect(workflow.jobs['db-copy-suite'].strategy).toBeUndefined()
    expect(workflow.jobs.pair.if).toContain("inputs.stage != 'db-copy-expanded'")
  })

  it('merges coverage from a separately instrumented seed-like process without a database', async () => {
    const directory = path.resolve(`tmp/ci-diagnostics/native-seed-merge-${Date.now()}`)
    mkdirSync(directory, { recursive: true })
    const hook = path.resolve('src/hooks/immutability.ts')
    try {
      prepareSeedConfig(directory)
      const seedConfig = readFileSync(path.join(directory, 'template-seed/vitest.config.mjs'), 'utf8')
      expect(seedConfig).toContain('globalSetup: undefined')
      expect(seedConfig).toContain('baselineTemplate.diagnostic.ts')
      expect(seedConfig).not.toContain('include: ["tests/integration/')
      for (const [position, target] of [directory, path.join(directory, 'template-seed')].entries()) {
        const test = path.join(target, 'fixture.test.ts')
        writeFileSync(
          test,
          `import { it, expect } from 'vitest'; import { beforeChangeImmutableField } from ${JSON.stringify(hook)}; it('exercises a distinct product hook branch', async () => { const fn = beforeChangeImmutableField({field: 'slug'}); ${position === 0 ? "expect(await fn({data: {slug: 'new'}, operation: 'create'})).toEqual({slug: 'new'})" : "await expect(fn({data: {slug: 'changed'}, originalDoc: {slug: 'original'}, operation: 'update'})).rejects.toThrow('cannot be changed')"} });`,
        )
        const config = path.join(target, 'fixture.config.mjs')
        writeFileSync(
          config,
          `export default { test: { projects: [{ test: { name: 'integration', include: [${JSON.stringify(test)}] } }], reporters: [['blob', { outputFile: ${JSON.stringify(path.join(target, 'blob.json'))} }]], coverage: { provider: 'v8', include: [${JSON.stringify(hook)}], reporter: ['json-summary'], reportsDirectory: ${JSON.stringify(path.join(target, 'coverage'))} } } }`,
        )
        const result = await measuredProcess(
          process.execPath,
          [
            path.resolve('node_modules/vitest/vitest.mjs'),
            'run',
            '--config',
            config,
            '--project',
            'integration',
            '--coverage',
          ],
          { timeoutMs: 15000 },
        )
        expect(result.code).toBe(0)
      }
      const original = JSON.parse(readFileSync(path.join(directory, 'coverage/coverage-summary.json'), 'utf8'))[hook]
      expect(await mergeSeedCoverage(directory)).toBeGreaterThan(0)
      const merged = JSON.parse(
        readFileSync(path.join(directory, 'seed-merged/coverage/coverage-summary.json'), 'utf8'),
      )[hook]
      expect(merged.branches.covered).toBeGreaterThan(original.branches.covered)
      expect(merged.lines.covered).toBeGreaterThanOrEqual(original.lines.covered)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }, 45000)
})
