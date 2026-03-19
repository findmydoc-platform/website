import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { seedAdvanceHandler, seedGetHandler, seedPostHandler } from '@/endpoints/seed/seedEndpoint'

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

function makePayloadReq(query: Record<string, unknown>) {
  const payload = createMockPayload()
  const req = createMockReq(mockUsers.platform(), payload, { query }) as PayloadRequest
  return { payload, req }
}

describe('seed endpoints success paths', () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete (global as Record<string, unknown>).__lastSeedRun
  })

  it('queues a baseline run and returns a run snapshot', async () => {
    const { payload, req } = makePayloadReq({ type: 'baseline', reset: '1' })
    const res = makeRes()

    await seedPostHandler(req, res)

    const postBody = res._body as {
      type: string
      reset: boolean
      queue: string
      title: string
      status: string
      runId: string
      progress: { total: number; completed: number; percent: number }
    }

    expect(res._status).toBe(202)
    expect(postBody.type).toBe('baseline')
    expect(postBody.reset).toBe(true)
    expect(postBody.queue).toMatch(/^seed:/)
    expect(postBody.title).toBe('Baseline seed with reset')
    expect(postBody.status).toBe('queued')
    expect(postBody.progress).toEqual({
      completed: 0,
      total: payload.jobs.queue.mock.calls.length,
      percent: 0,
    })
    expect(payload.jobs.queue.mock.calls.length).toBeGreaterThan(0)
    expect(payload.kv.set).toHaveBeenCalledWith(expect.stringMatching(/^seed:run:/), expect.any(Object))

    const postRunId = postBody.runId
    const getRes = makeRes()
    await seedGetHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId: postRunId },
      }) as PayloadRequest,
      getRes,
    )

    const getBody = getRes._body as {
      runId: string
      queue: string
      title: string
      jobIds: string[]
    }

    expect(getRes._status).toBe(200)
    expect(getBody.runId).toBe(postRunId)
    expect(getBody.queue).toBe(postBody.queue)
    expect(getBody.title).toBe(postBody.title)
    expect(getBody.jobIds).toHaveLength(payload.jobs.queue.mock.calls.length)
  })

  it('returns the latest run when no run id is provided', async () => {
    const { payload, req } = makePayloadReq({ type: 'demo' })
    const res = makeRes()

    await seedPostHandler(req, res)

    const getRes = makeRes()
    await seedGetHandler(createMockReq(mockUsers.platform(), payload, { query: {} }) as PayloadRequest, getRes)

    const getBody = getRes._body as { runId: string }
    expect(getRes._status).toBe(200)
    expect(getBody.runId).toBe((res._body as { runId: string }).runId)
  })

  it('keeps the active run visible during advance polling', async () => {
    const { payload, req } = makePayloadReq({ type: 'baseline' })
    const res = makeRes()

    await seedPostHandler(req, res)

    const advanceRes = makeRes()
    await seedAdvanceHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId: res._body.runId },
      }) as PayloadRequest,
      advanceRes,
    )

    const advanceBody = advanceRes._body as { runId: string; progress: { total: number } }
    const postBody = res._body as { runId: string; progress: { total: number } }
    expect(advanceRes._status).toBe(200)
    expect(advanceBody.runId).toBe(postBody.runId)
    expect(advanceBody.progress.total).toBe(postBody.progress.total)
  })
})
