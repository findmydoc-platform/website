import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const postgres = vi.hoisted(() => ({
  failConnect: false,
  closed: 0,
  fingerprint: 'stale',
  restoredFingerprint: 'stale',
  restores: 0,
  failRestore: false,
  metadataReads: 0,
}))

vi.mock('pg', () => ({
  default: {
    Client: class {
      async connect() {
        if (postgres.failConnect) throw new Error('synthetic connection failure')
      }
      async end() {
        postgres.closed += 1
      }
      async query(sql: string) {
        if (sql.includes('SELECT template_kind')) {
          postgres.metadataReads += 1
          return {
            rows: [
              {
                template_kind: 'baseline',
                fingerprint: postgres.metadataReads === 1 ? postgres.fingerprint : postgres.restoredFingerprint,
              },
            ],
          }
        }
        if (sql.includes('CREATE DATABASE')) {
          if (postgres.failRestore) throw new Error('synthetic restore failure')
          postgres.restores += 1
        }
        return { rows: [] }
      }
    },
  },
}))
import * as harness from '../../../scripts/test-database-harness.mjs'

afterEach(() => vi.unstubAllEnvs())
beforeEach(() => {
  postgres.failConnect = false
  postgres.closed = 0
  postgres.metadataReads = 0
  postgres.restores = 0
  postgres.failRestore = false
  postgres.fingerprint = 'stale'
  postgres.restoredFingerprint = 'stale'
})

it('rejects a stale template without replacing the working database', async () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@localhost:5433/findmydoc-test-ci')
  await expect(harness.restoreIntegrationBaseline()).rejects.toThrow('template is missing or stale')
  expect(postgres.restores).toBe(0)
  expect(postgres.closed).toBe(1)
})

it('restores a fresh working database from the current baseline and closes every connection', async () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@localhost:5433/findmydoc-test-ci')
  postgres.fingerprint = harness.computeTestDatabaseFingerprint({ templateKind: 'baseline' })
  postgres.restoredFingerprint = postgres.fingerprint

  await expect(harness.restoreIntegrationBaseline()).resolves.toBeUndefined()
  expect(postgres.restores).toBe(1)
  expect(postgres.metadataReads).toBe(2)
  expect(postgres.closed).toBe(3)
})

it('does not admit a copy whose restored metadata does not match the template fingerprint', async () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@localhost:5433/findmydoc-test-ci')
  postgres.fingerprint = harness.computeTestDatabaseFingerprint({ templateKind: 'baseline' })
  await expect(harness.restoreIntegrationBaseline()).rejects.toThrow('not a current baseline copy')
  expect(postgres.closed).toBe(3)
})

it('closes the administration connection if replacing the working database fails', async () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@localhost:5433/findmydoc-test-ci')
  postgres.fingerprint = harness.computeTestDatabaseFingerprint({ templateKind: 'baseline' })
  postgres.failRestore = true
  await expect(harness.restoreIntegrationBaseline()).rejects.toThrow('synthetic restore failure')
  expect(postgres.closed).toBe(2)
})

it.each([
  ['NODE_ENV', 'production', 'isolated test runner'],
  ['INTEGRATION_BASELINE_COPY', undefined, 'isolated test runner'],
  ['TEST_DB_REBUILD_TEMPLATES', '1', 'full service reset'],
  ['DATABASE_URI', 'postgresql://postgres@localhost/findmydoc-production', 'unsafe database name'],
])('rejects an unsafe %s setting before opening PostgreSQL', async (name, value, message) => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@localhost:5433/findmydoc-test-ci')
  vi.stubEnv(name, value)
  await expect(harness.restoreIntegrationBaseline()).rejects.toThrow(message)
  expect(postgres.closed).toBe(0)
})

it('refuses a remote database before restoring an integration baseline, even with the general remote opt-in', async () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('TEST_DB_ALLOW_REMOTE', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@db.example.test/findmydoc-test-ci')

  await expect(harness.restoreIntegrationBaseline()).rejects.toThrow('remote target')
})

it('refuses remote test storage before opening a baseline database connection', async () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@localhost:5433/findmydoc-test-ci')
  vi.stubEnv('S3_TEST_ENDPOINT', 'https://storage.example.test')
  await expect(harness.restoreIntegrationBaseline()).rejects.toThrow('local test storage')
  expect(postgres.closed).toBe(0)
})

it('closes a failed PostgreSQL connection without proceeding to a database restore', async () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@localhost:5433/findmydoc-test-ci')
  postgres.failConnect = true

  await expect(harness.restoreIntegrationBaseline()).rejects.toThrow('synthetic connection failure')
  expect(postgres.closed).toBe(1)
})
