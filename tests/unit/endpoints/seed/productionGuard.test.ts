import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

type MockResponse = {
  _status?: number
  _body: Record<string, unknown>
  status: (code: number) => MockResponse
  json: (body: unknown) => MockResponse
}

vi.mock('@/endpoints/seed/baseline', () => ({
  runBaselineSeeds: vi.fn(async () => ({ units: [], warnings: [], failures: [] })),
}))
vi.mock('@/endpoints/seed/demo', () => ({
  runDemoSeeds: vi.fn(async () => ({ units: [], warnings: [], failures: [] })),
}))

import { seedPostHandler } from '@/endpoints/seed/seedEndpoint'

function makeReq(): unknown {
  return {
    query: { type: 'demo' },
    user: { userType: 'platform' },
    payload: { logger: { info: () => {}, warn: () => {}, error: () => {} } },
  }
}
function makeRes(): MockResponse {
  const res: Partial<MockResponse> = {
    _status: 0,
    _body: {},
    status: (code: number) => {
      res._status = code
      return res as MockResponse
    },
    json: (body: unknown) => {
      res._body = body as Record<string, unknown>
      return res as MockResponse
    },
  }

  return res as MockResponse
}

describe('production demo guard', () => {
  const originalEnv = process.env.NODE_ENV
  it('blocks demo seeding in production', async () => {
    // @ts-expect-error override for test
    process.env.NODE_ENV = 'production'
    const req = makeReq() as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(400)
    expect(res._body.error).toMatch(/disabled/)
    // restore
    // @ts-expect-error restore
    process.env.NODE_ENV = originalEnv
  })
})
