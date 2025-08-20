import { describe, it, expect, vi } from 'vitest'

// We mock the dynamic imports used by seedEndpoint so we can simulate a failure
vi.mock('@/endpoints/seed/baseline', () => ({
  runBaselineSeeds: vi.fn(async () => {
    throw new Error('boom')
  }),
}))
vi.mock('@/endpoints/seed/demo', () => ({
  runDemoSeeds: vi.fn(),
}))

import { seedPostHandler } from '@/endpoints/seed/seedEndpoint'

function makeReq(): any {
  return {
    query: { type: 'baseline' },
    user: { userType: 'platform' },
    payload: {
      logger: { info: () => {}, error: () => {} },
    },
  }
}

function makeRes() {
  const res: any = {}
  res.status = (code: number) => {
    res._status = code
    return res
  }
  res.json = (body: any) => {
    res._body = body
    return res
  }
  return res
}

describe('seed baseline fail-fast', () => {
  it('returns 500 when a baseline seed unit fails', async () => {
    const req = makeReq()
    const res = makeRes()
    await seedPostHandler(req as any, res)
    expect(res._status).toBe(500)
    expect(res._body.error).toBeDefined()
  })
})
