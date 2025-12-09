/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/endpoints/seed/baseline', () => ({ runBaselineSeeds: vi.fn(async () => []) }))
vi.mock('@/endpoints/seed/demo', () => ({ runDemoSeeds: vi.fn(async () => ({ units: [], partialFailures: [] })) }))

import { seedPostHandler } from '@/endpoints/seed/seedEndpoint'

function makeReq(): any {
  return {
    query: { type: 'demo' },
    user: { userType: 'platform' },
    payload: { logger: { info: () => {}, warn: () => {}, error: () => {} } },
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

describe('production demo guard', () => {
  const originalEnv = process.env.NODE_ENV
  it('blocks demo seeding in production', async () => {
    // @ts-expect-error override for test
    process.env.NODE_ENV = 'production'
    const req = makeReq()
    const res = makeRes()
    await seedPostHandler(req as any, res)
    expect(res._status).toBe(400)
    expect(res._body.error).toMatch(/disabled/)
    // restore
    // @ts-expect-error restore
    process.env.NODE_ENV = originalEnv
  })
})
