/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

const mockOutcome = {
  units: [{ name: 'good', created: 1, updated: 0 }],
  partialFailures: [{ name: 'bad', error: 'oops' }],
  beforeCounts: undefined,
  afterCounts: undefined,
}

vi.mock('@/endpoints/seed/demo', () => ({
  runDemoSeeds: vi.fn(async () => mockOutcome),
}))
vi.mock('@/endpoints/seed/baseline', () => ({
  runBaselineSeeds: vi.fn(async () => []),
}))

import { seedPostHandler } from '@/endpoints/seed/seedEndpoint'

function makeReq(): any {
  return {
    query: { type: 'demo' },
    user: { userType: 'platform' },
    payload: {
      logger: { info: () => {}, warn: () => {}, error: () => {} },
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

describe('demo seed partial aggregation', () => {
  it('returns 200 partial when some units fail', async () => {
    const req = makeReq()
    const res = makeRes()
    await seedPostHandler(req as any, res)
    expect(res._status).toBe(200)
    expect(res._body.status).toBe('partial')
    expect(res._body.partialFailures).toHaveLength(1)
    expect(res._body.units).toHaveLength(1)
  })
})
