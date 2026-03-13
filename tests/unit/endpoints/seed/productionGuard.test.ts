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
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('blocks demo seeding in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const req = makeReq() as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(405)
    expect(res._body.error).toMatch(/disabled in production runtime/i)
  })
})

describe('production guard via VERCEL_ENV', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('blocks demo seeding when VERCEL_ENV=production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', '')
    const req = makeReq() as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(405)
    expect(res._body.error).toMatch(/disabled in production runtime/i)
  })

  it('blocks reset when VERCEL_ENV=production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', '')
    const req = createMockReq(mockUsers.platform(), undefined, {
      query: { type: 'baseline', reset: '1' },
    }) as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(405)
    expect(res._body.error).toMatch(/disabled in production runtime/i)
  })

  it('allows seed POST in preview runtime', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('DEPLOYMENT_ENV', '')

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

  it('ignores legacy endpoint override in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', '')
    vi.stubEnv('SEED_ENDPOINT_ALLOW_POST', 'true')
    const req = makeReq() as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(405)
    expect(res._body.error).toMatch(/disabled in production runtime/i)
  })

  it('allows baseline seeding in development runtime', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', '')
    vi.stubEnv('NODE_ENV', 'development')
    const req = createMockReq(mockUsers.platform(), undefined, {
      query: { type: 'baseline' },
    }) as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(200)
  })
})
