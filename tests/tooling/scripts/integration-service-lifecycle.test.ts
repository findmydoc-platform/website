import { afterEach, expect, it, vi } from 'vitest'

const system = vi.hoisted(() => ({
  commands: [] as string[],
  failStop: false,
  failStart: false,
  connections: 0,
  closed: 0,
}))
vi.mock('node:child_process', () => ({
  execSync: (command: string) => {
    system.commands.push(command)
    if (system.failStop && command.includes(' stop ')) throw new Error('synthetic service stop failure')
    if (system.failStart && command.includes(' up ')) throw new Error('synthetic partial startup failure')
  },
}))
vi.mock('node:timers/promises', () => ({ setTimeout: async () => undefined }))
vi.mock('pg', () => ({
  default: {
    Client: class {
      async connect() {
        system.connections += 1
      }
      async end() {
        system.closed += 1
      }
      async query() {
        return { rows: [] }
      }
    },
  },
}))
import { setupTestDatabase, teardownTestDatabase } from '../../../scripts/test-database-harness.mjs'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('stops both owned test services and exposes cleanup failure in the strict integration mode', async () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@localhost:5433/findmydoc-test-ci')
  vi.stubEnv('S3_TEST_ENDPOINT', 'http://localhost:9091')
  vi.stubEnv('TEST_DB_REBUILD_TEMPLATES', '')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  system.commands = []
  system.connections = 0
  system.closed = 0
  system.failStop = false
  system.failStart = false
  await setupTestDatabase({ templateKind: 'baseline', seedBaseline: async () => undefined })
  expect(system.closed).toBe(system.connections)
  system.failStop = true
  try {
    await expect(teardownTestDatabase({ strict: true })).rejects.toThrow('synthetic service stop failure')
    expect(system.commands.at(-1)).toContain('stop postgres s3mock')
  } finally {
    system.failStop = false
    await teardownTestDatabase()
  }
})

it('retains cleanup ownership if test services fail partway through startup', async () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('INTEGRATION_BASELINE_COPY', '1')
  vi.stubEnv('DATABASE_URI', 'postgresql://postgres@localhost:5433/findmydoc-test-ci')
  vi.stubEnv('S3_TEST_ENDPOINT', 'http://localhost:9091')
  vi.stubEnv('TEST_DB_REBUILD_TEMPLATES', '')
  system.commands = []
  system.failStart = true
  try {
    await expect(setupTestDatabase({ templateKind: 'baseline', seedBaseline: async () => undefined })).rejects.toThrow(
      'synthetic partial startup failure',
    )
  } finally {
    system.failStart = false
    await teardownTestDatabase({ strict: true })
  }
  expect(system.commands.at(-1)).toContain('stop postgres s3mock')
})
