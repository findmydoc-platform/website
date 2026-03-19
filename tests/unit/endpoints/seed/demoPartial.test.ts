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

describe('demo seed chunking', () => {
  it('queues media-heavy demo jobs in chunks', async () => {
    const payload = createMockPayload()
    const req = createMockReq(mockUsers.platform(), payload, {
      query: { type: 'demo' },
    }) as PayloadRequest
    const res = makeRes()

    await seedPostHandler(req, res)

    const postBody = res._body as { runId: string }
    expect(res._status).toBe(202)
    expect(payload.jobs.queue.mock.calls.length).toBeGreaterThan(0)

    const queuedInputs = payload.jobs.queue.mock.calls.map(
      ([call]) => (call as { input?: Record<string, unknown> }).input,
    )
    const chunkedInputs = queuedInputs.filter((input) => input?.chunkTotal && Number(input.chunkTotal) > 1)

    expect(chunkedInputs.length).toBeGreaterThan(0)
    expect(chunkedInputs.some((input) => input?.stepName === 'platform-content-media')).toBe(true)

    const runId = postBody.runId
    const getRes = makeRes()
    await seedGetHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId },
      }) as PayloadRequest,
      getRes,
    )

    const getBody = getRes._body as { runId: string; progress: { total: number } }
    expect(getRes._status).toBe(200)
    expect(getBody.runId).toBe(runId)
    expect(getBody.progress.total).toBe(payload.jobs.queue.mock.calls.length)
  })
})
