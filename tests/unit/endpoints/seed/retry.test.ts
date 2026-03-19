import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { seedRetryHandler } from '@/endpoints/seed/seedEndpoint'
import { formatSeedJobTitle, formatSeedRetryTitle, formatSeedRunTitle } from '@/endpoints/seed/utils/labels'
import { createSeedRunRecord, saveSeedRunRecord, type SeedRunRecord } from '@/endpoints/seed/utils/state'

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

const makeRetryableJob = (args: {
  runId: string
  queue: string
  id: string
  order: number
  status: 'succeeded' | 'failed' | 'cancelled'
  chunkIndex: number
  chunkTotal: number
}): SeedRunRecord['jobs'][number] => {
  const title = formatSeedJobTitle('platformContentMedia', args.chunkIndex, args.chunkTotal)
  const now = '2026-03-19T10:05:25.000Z'

  return {
    id: args.id,
    order: args.order,
    status: args.status,
    input: {
      runId: args.runId,
      type: 'baseline',
      reset: false,
      queue: args.queue,
      title,
      stepName: 'platformContentMedia',
      kind: 'collection',
      collection: 'platformContentMedia',
      fileName: 'platformContentMedia',
      chunkIndex: args.chunkIndex,
      chunkTotal: args.chunkTotal,
    },
    queue: args.queue,
    title,
    stepName: 'platformContentMedia',
    kind: 'collection',
    collection: 'platformContentMedia',
    fileName: 'platformContentMedia',
    chunkIndex: args.chunkIndex,
    chunkTotal: args.chunkTotal,
    createdAt: now,
    startedAt: now,
    completedAt: now,
    created: args.status === 'succeeded' ? 1 : 0,
    updated: args.status === 'failed' ? 2 : 1,
    warnings: [],
    failures: args.status === 'failed' ? ['Storage upload failed after retry.'] : [],
    error: args.status === 'failed' ? 'Storage upload failed after retry.' : undefined,
  }
}

const seedSourceRun = async (payload: ReturnType<typeof createMockPayload>) => {
  const runId = 'source-run'
  const queue = `seed:${runId}`
  const record = createSeedRunRecord({
    runId,
    type: 'baseline',
    reset: false,
    queue,
    totalJobs: 3,
  })

  record.status = 'partial'
  record.startedAt = '2026-03-19T10:05:25.000Z'
  record.completedAt = '2026-03-19T10:05:25.000Z'
  record.completedJobs = 3
  record.succeededJobs = 1
  record.failedJobs = 1
  record.cancelledJobs = 1
  record.jobs = [
    makeRetryableJob({
      runId,
      queue,
      id: 'job-1',
      order: 1,
      status: 'succeeded',
      chunkIndex: 1,
      chunkTotal: 3,
    }),
    makeRetryableJob({
      runId,
      queue,
      id: 'job-2',
      order: 2,
      status: 'failed',
      chunkIndex: 2,
      chunkTotal: 3,
    }),
    makeRetryableJob({
      runId,
      queue,
      id: 'job-3',
      order: 3,
      status: 'cancelled',
      chunkIndex: 3,
      chunkTotal: 3,
    }),
  ]

  await saveSeedRunRecord(payload, record)
  return record
}

describe('seed retry endpoint', () => {
  it('queues all failed and cancelled jobs into a new retry run', async () => {
    const payload = createMockPayload()
    const sourceRun = await seedSourceRun(payload)
    const req = createMockReq(mockUsers.platform(), payload, {
      query: { runId: sourceRun.runId },
    }) as PayloadRequest
    const res = makeRes()

    await seedRetryHandler(req, res)

    const body = res._body as {
      runId: string
      title: string
      status: string
      queue: string
      progress: { total: number; completed: number; percent: number }
    }

    expect(res._status).toBe(202)
    expect(body.title).toBe(formatSeedRetryTitle(formatSeedRunTitle('baseline', false)))
    expect(body.status).toBe('queued')
    expect(body.progress).toEqual({
      completed: 0,
      total: 2,
      percent: 0,
    })
    expect(body.queue).toMatch(/^seed:/)
    expect(payload.jobs.queue).toHaveBeenCalledTimes(2)

    const queuedInputs = payload.jobs.queue.mock.calls.map(
      ([call]) => (call as { input?: Record<string, unknown> }).input,
    )
    expect(queuedInputs[0]?.title).toBe(formatSeedRetryTitle(formatSeedJobTitle('platformContentMedia', 2, 3)))
    expect(queuedInputs[1]?.title).toBe(formatSeedRetryTitle(formatSeedJobTitle('platformContentMedia', 3, 3)))
  })

  it('queues only the selected failed job when a job id is provided', async () => {
    const payload = createMockPayload()
    const sourceRun = await seedSourceRun(payload)
    const req = createMockReq(mockUsers.platform(), payload, {
      query: { runId: sourceRun.runId, jobId: 'job-2' },
    }) as PayloadRequest
    const res = makeRes()

    await seedRetryHandler(req, res)

    const body = res._body as {
      runId: string
      title: string
      progress: { total: number }
    }

    expect(res._status).toBe(202)
    expect(body.title).toBe(formatSeedRetryTitle(formatSeedRunTitle('baseline', false)))
    expect(body.progress.total).toBe(1)
    expect(payload.jobs.queue).toHaveBeenCalledTimes(1)
    expect((payload.jobs.queue.mock.calls[0]?.[0] as { input?: Record<string, unknown> }).input?.title).toBe(
      formatSeedRetryTitle(formatSeedJobTitle('platformContentMedia', 2, 3)),
    )
  })
})
