import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const configMocks = vi.hoisted(() => ({
  postgresAdapter: vi.fn((options: unknown) => ({
    init: vi.fn(),
    name: 'postgres',
    options,
  })),
}))

vi.mock('@payloadcms/db-postgres', () => ({
  postgresAdapter: configMocks.postgresAdapter,
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    buildConfig: vi.fn((config: unknown) => config),
  }
})

describe('Payload database configuration', () => {
  beforeEach(() => {
    vi.resetModules()
    configMocks.postgresAdapter.mockClear()
    vi.stubEnv('DATABASE_URI', 'postgresql://runtime.example.test:6543/postgres')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_ENV', 'preview')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exposes the bounded runtime pool and database availability hook to Payload', async () => {
    const { default: config } = await import('@/payload.config')

    expect(configMocks.postgresAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        pool: {
          connectionString: 'postgresql://runtime.example.test:6543/postgres',
          connectionTimeoutMillis: 3_000,
          idleTimeoutMillis: 10_000,
          max: 4,
        },
      }),
    )
    expect(config).toEqual(
      expect.objectContaining({
        hooks: {
          afterError: [expect.any(Function)],
        },
      }),
    )
  })
})
