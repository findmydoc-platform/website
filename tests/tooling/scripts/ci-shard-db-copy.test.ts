import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { analyzeCopyRounds, renderCopySummary } from '../../../scripts/ci-shard-db-copy-summary.mjs'
import { hookFiles, hookTestCounts } from '../../../scripts/ci-shard-hook-validation.mjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlan, runDiagnostic } from '../../../scripts/ci-shard-diagnostics.mjs'
import {
  assertBaselineWorkingDatabase,
  computeTestDatabaseFingerprint,
  copyBaselineWorkingDatabase,
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
