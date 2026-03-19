import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

type MockResponse = {
  _status?: number
  _body: Record<string, unknown>
  status: (code: number) => MockResponse
  json: (body: unknown) => MockResponse
}

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { seedGetHandler, seedPostHandler } from '@/endpoints/seed/seedEndpoint'

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
  it('returns 500 when queueing the first baseline job fails', async () => {
    const payload = createMockPayload()
    payload.jobs.queue.mockRejectedValueOnce(new Error('boom'))
    const req = createMockReq(mockUsers.platform(), payload, {
      query: { type: 'baseline' },
    }) as PayloadRequest
    const res = makeRes()

    await seedPostHandler(req, res)

    expect(res._status).toBe(500)
    expect(res._body.error).toBe('Seed failed')
    expect(res._body.detail).toBeUndefined()
  })

  it('does not fall back to a different run when the requested run is missing', async () => {
    const payload = createMockPayload()
    const req = createMockReq(mockUsers.platform(), payload, {
      query: { runId: 'missing-run-id' },
    }) as PayloadRequest
    const res = makeRes()

    await seedGetHandler(req, res)

    expect(res._status).toBe(200)
    expect(res._body.message).toBe('Seed run not found')
  })
})
