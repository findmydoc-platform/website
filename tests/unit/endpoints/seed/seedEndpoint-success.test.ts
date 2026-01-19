import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

const mockRunBaselineSeeds = vi.hoisted(() => vi.fn())
const mockRunDemoSeeds = vi.hoisted(() => vi.fn())

vi.mock('@/endpoints/seed/baseline', () => ({ runBaselineSeeds: mockRunBaselineSeeds }))
vi.mock('@/endpoints/seed/demo', () => ({ runDemoSeeds: mockRunDemoSeeds }))

import { seedGetHandler, seedPostHandler } from '@/endpoints/seed/seedEndpoint'

type MockResponse = {
  _status?: number
  _body: Record<string, unknown>
  status: (code: number) => MockResponse
  json: (body: unknown) => MockResponse
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

function makePayloadReq(query: Record<string, unknown>): PayloadRequest {
  return createMockReq(mockUsers.platform(), undefined, { query }) as PayloadRequest
}

describe('seed endpoints success paths', () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete (global as Record<string, unknown>).__lastSeedRun
  })

  it('returns baseline summary and caches result', async () => {
    mockRunBaselineSeeds.mockResolvedValueOnce({
      units: [{ name: 'countries', created: 1, updated: 2, warnings: [], failures: [] }],
      warnings: [],
      failures: [],
    })

    const req = makePayloadReq({ type: 'baseline', reset: '1' })
    const res = makeRes()

    await seedPostHandler(req, res)

    expect(mockRunBaselineSeeds).toHaveBeenCalledWith(req.payload, { reset: true })
    expect(res._status).toBe(200)
    expect(res._body.type).toBe('baseline')
    expect(res._body.reset).toBe(true)
    expect(res._body.totals).toEqual({ created: 1, updated: 2 })
    expect(res._body.status).toBe('ok')
    expect((global as Record<string, unknown>).__lastSeedRun).toBeDefined()
  })

  it('returns cached summary via GET for platform user', async () => {
    const cached = {
      type: 'baseline',
      status: 'ok',
      totals: { created: 0, updated: 0 },
    }
    ;(global as Record<string, unknown>).__lastSeedRun = cached

    const res = makeRes()
    await seedGetHandler(makePayloadReq({}), res)

    expect(res._status).toBe(200)
    expect(res._body).toEqual(cached)
  })
})
