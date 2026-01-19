import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

type MockResponse = {
  _status?: number
  _body: Record<string, unknown>
  status: (code: number) => MockResponse
  json: (body: unknown) => MockResponse
}

const mockOutcome = {
  units: [{ name: 'good', created: 1, updated: 0, warnings: [], failures: [] }],
  warnings: ['warn'],
  failures: ['oops'],
}

vi.mock('@/endpoints/seed/demo', () => ({
  runDemoSeeds: vi.fn(async () => mockOutcome),
}))
vi.mock('@/endpoints/seed/baseline', () => ({
  runBaselineSeeds: vi.fn(async () => []),
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

describe('demo seed partial aggregation', () => {
  it('returns 200 partial when some units fail', async () => {
    const req = makeReq() as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(200)
    expect(res._body.status).toBe('partial')
    expect(res._body.failures).toHaveLength(1)
    expect(res._body.units).toHaveLength(1)
  })
})
