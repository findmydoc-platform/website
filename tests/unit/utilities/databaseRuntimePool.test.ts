import { describe, expect, it } from 'vitest'

import { createPayloadRuntimePoolConfig } from '@/features/databaseAvailability'

describe('createPayloadRuntimePoolConfig', () => {
  it('exposes the fixed Payload pool policy with the runtime connection only', () => {
    const config = createPayloadRuntimePoolConfig({
      DATABASE_DIRECT_URI: 'postgresql://direct.example.test:5432/postgres',
      DATABASE_URI: 'postgresql://runtime.example.test:6543/postgres',
      VERCEL: '1',
      VERCEL_ENV: 'preview',
    })

    expect(config).toEqual({
      connectionString: 'postgresql://runtime.example.test:6543/postgres',
      connectionTimeoutMillis: 3_000,
      idleTimeoutMillis: 10_000,
      max: 4,
    })
  })

  it('rejects a direct Postgres port for Vercel runtime traffic', () => {
    expect(() =>
      createPayloadRuntimePoolConfig({
        DATABASE_URI: 'postgresql://db.example.test:5432/postgres',
        VERCEL: '1',
        VERCEL_ENV: 'production',
      }),
    ).toThrow('DATABASE_URI must use a transaction pooler on port 6543 in Vercel runtimes.')
  })

  it('allows a direct connection only inside the explicit migration child process', () => {
    expect(
      createPayloadRuntimePoolConfig({
        DATABASE_URI: 'postgresql://db.example.test:5432/postgres',
        PAYLOAD_DATABASE_OPERATION: 'migration',
        VERCEL: '1',
        VERCEL_ENV: 'preview',
      }),
    ).toEqual({
      connectionString: 'postgresql://db.example.test:5432/postgres',
      connectionTimeoutMillis: 3_000,
      idleTimeoutMillis: 10_000,
      max: 4,
    })
  })

  it('allows local Postgres without imposing a hosted pooler address', () => {
    expect(
      createPayloadRuntimePoolConfig({
        DATABASE_URI: 'postgresql://localhost:5433/findmydoc-test',
        NODE_ENV: 'test',
      }),
    ).toEqual({
      connectionString: 'postgresql://localhost:5433/findmydoc-test',
      connectionTimeoutMillis: 3_000,
      idleTimeoutMillis: 10_000,
      max: 4,
    })
  })
})
