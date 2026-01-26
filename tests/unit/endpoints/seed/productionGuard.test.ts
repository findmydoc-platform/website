import { describe, it, expect, vi, afterEach } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

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
  return createMockReq(mockUsers.platform(), undefined, { query: { type: 'demo' } })
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
  const originalEnv = process.env
  it('blocks demo seeding in production', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' }
    const req = makeReq() as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(400)
    expect(res._body.error).toMatch(/disabled/)
    // restore
    process.env = originalEnv
  })
})

describe('production guard via VERCEL_ENV', () => {
  const originalEnv = process.env

  afterEach(() => {
    // restore
    process.env = originalEnv
  })

  it('blocks demo seeding when VERCEL_ENV=production', async () => {
    process.env = { ...process.env, VERCEL_ENV: 'production' }
    const req = makeReq() as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(400)
    expect(res._body.error).toMatch(/disabled/)
  })

  it('blocks reset when VERCEL_ENV=production', async () => {
    process.env = { ...process.env, VERCEL_ENV: 'production' }
    const req = createMockReq(mockUsers.platform(), undefined, {
      query: { type: 'baseline', reset: '1' },
    }) as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(400)
    expect(res._body.error).toMatch(/disabled/)
  })

  it('allows demo seeding and reset when VERCEL_ENV=preview', async () => {
    process.env = { ...process.env, VERCEL_ENV: 'preview' }

    const reqDemo = makeReq() as PayloadRequest
    const resDemo = makeRes()
    await seedPostHandler(reqDemo, resDemo)
    expect(resDemo._status).toBe(200)

    const reqReset = createMockReq(mockUsers.platform(), undefined, {
      query: { type: 'baseline', reset: '1' },
    }) as PayloadRequest
    const resReset = makeRes()
    await seedPostHandler(reqReset, resReset)
    expect(resReset._status).toBe(200)
  })
})
