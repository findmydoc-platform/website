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

function makeReq(): unknown {
  return createMockReq(mockUsers.platform(), undefined, { query: { type: 'baseline' } })
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

describe('seed baseline fail-fast', () => {
  it('returns 500 when a baseline seed unit fails', async () => {
    const req = makeReq() as PayloadRequest
    const res = makeRes()
    await seedPostHandler(req, res)
    expect(res._status).toBe(500)
    expect(res._body.error).toBeDefined()
  })
})
