import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { revalidatePath, revalidateTag } from 'next/cache'
import { seedAdvanceHandler, seedGetHandler, seedPostHandler } from '@/endpoints/seed/seedEndpoint'
import { finalizeSeedRunPublicCaches } from '@/endpoints/seed/utils/finalFlush'
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

  it.each(['completed', 'partial', 'failed', 'cancelled'] as const)(
    'runs one terminal seed final flush for %s runs with public work',
    async (status) => {
      const { payload } = makePayloadReq({})
      const runId = `seed-run-${status}`
      const queue = `seed:${runId}`
      const record = createSeedRunRecord({
        runId,
        type: 'demo',
        reset: false,
        queue,
        totalJobs: 1,
      }) as SeedRunRecord
      record.status = status
      record.completedAt = '2026-07-08T10:00:00.000Z'
      record.completedJobs = 1
      record.succeededJobs = status === 'failed' ? 0 : 1
      record.failedJobs = status === 'failed' ? 1 : 0
      const jobStatus = status === 'cancelled' ? 'cancelled' : status === 'failed' ? 'failed' : 'succeeded'
      record.jobs = [
        {
          id: 'job-posts',
          order: 1,
          status: jobStatus,
          input: {
            runId,
            type: 'demo',
            reset: false,
            queue,
            stepName: 'posts',
            kind: 'collection',
            collection: 'posts',
            fileName: 'posts',
          },
          queue,
          title: 'Posts',
          stepName: 'posts',
          kind: 'collection',
          collection: 'posts',
          fileName: 'posts',
          createdAt: '2026-07-08T09:00:00.000Z',
          completedAt: '2026-07-08T10:00:00.000Z',
          created: status === 'failed' || status === 'cancelled' ? 0 : 1,
          updated: status === 'failed' || status === 'cancelled' ? 1 : 0,
          warnings: [],
          failures: status === 'failed' ? ['partial write failed'] : [],
        },
      ]
      await saveSeedRunRecord(payload as unknown as Payload, record)

      const res = makeRes()
      await seedAdvanceHandler(
        createMockReq(mockUsers.platform(), payload, {
          query: { runId },
        }) as PayloadRequest,
        res,
      )

      const body = res._body as { finalFlush?: { status: string; tagCount: number; pathCount: number } }
      expect(res._status).toBe(200)
      expect(body.finalFlush).toMatchObject({
        status: 'executed',
        tagCount: 5,
        pathCount: 4,
      })
      expect(revalidateTag).toHaveBeenCalledWith('collection:posts', { expire: 0 })
      expect(revalidateTag).toHaveBeenCalledWith('surface:posts-list', { expire: 0 })
      expect(revalidateTag).toHaveBeenCalledWith('surface:sitemap:posts', { expire: 0 })
      expect(revalidatePath).toHaveBeenCalledWith('/posts')
      expect(revalidatePath).toHaveBeenCalledWith('/posts-sitemap.xml')

      const tagCallCount = vi.mocked(revalidateTag).mock.calls.length
      const secondRes = makeRes()
      await seedAdvanceHandler(
        createMockReq(mockUsers.platform(), payload, {
          query: { runId },
        }) as PayloadRequest,
        secondRes,
      )

      expect(vi.mocked(revalidateTag).mock.calls).toHaveLength(tagCallCount)
    },
  )

  it('retries a failed terminal seed final flush on a later poll', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-retry-failed-final-flush'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    }) as SeedRunRecord
    record.status = 'completed'
    record.completedAt = '2026-07-08T10:00:00.000Z'
    record.completedJobs = 1
    record.succeededJobs = 1
    record.jobs = [
      {
        id: 'job-posts',
        order: 1,
        status: 'succeeded',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'posts',
          kind: 'collection',
          collection: 'posts',
          fileName: 'posts',
        },
        queue,
        title: 'Posts',
        stepName: 'posts',
        kind: 'collection',
        collection: 'posts',
        fileName: 'posts',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 1,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('temporary cache backend failure')
    })

    const firstRes = makeRes()
    await seedAdvanceHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId },
      }) as PayloadRequest,
      firstRes,
    )

    expect(firstRes._status).toBe(200)
    expect(firstRes._body.finalFlush).toMatchObject({
      status: 'failed',
      failureCount: 1,
      reason: 'executor-error',
    })

    vi.mocked(revalidateTag).mockClear()
    vi.mocked(revalidatePath).mockClear()

    const secondRes = makeRes()
    await seedAdvanceHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId },
      }) as PayloadRequest,
      secondRes,
    )

    expect(secondRes._status).toBe(200)
    expect(secondRes._body.finalFlush).toMatchObject({
      status: 'executed',
      failureCount: 0,
    })
    expect(revalidateTag).toHaveBeenCalledWith('collection:posts', { expire: 0 })
    expect(revalidatePath).toHaveBeenCalledWith('/posts')
  })

  it('does not flush a cancelled public seed job that never wrote public work', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-cancelled-public-empty'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    }) as SeedRunRecord
    record.status = 'cancelled'
    record.completedAt = '2026-07-08T10:00:00.000Z'
    record.completedJobs = 1
    record.cancelledJobs = 1
    record.jobs = [
      {
        id: 'job-posts',
        order: 1,
        status: 'cancelled',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'posts',
          kind: 'collection',
          collection: 'posts',
          fileName: 'posts',
        },
        queue,
        title: 'Posts',
        stepName: 'posts',
        kind: 'collection',
        collection: 'posts',
        fileName: 'posts',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 0,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    const res = makeRes()
    await seedAdvanceHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId },
      }) as PayloadRequest,
      res,
    )

    expect(res._status).toBe(200)
    expect((res._body as { finalFlush?: { status: string } }).finalFlush?.status).toBe('skipped')
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('flushes the pages sitemap when treatment seed data affects listing-comparison lastmod', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-treatment-sitemap'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    }) as SeedRunRecord
    record.status = 'completed'
    record.completedAt = '2026-07-08T10:00:00.000Z'
    record.completedJobs = 1
    record.succeededJobs = 1
    record.jobs = [
      {
        id: 'job-treatments',
        order: 1,
        status: 'succeeded',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'treatments',
          kind: 'collection',
          collection: 'treatments',
          fileName: 'treatments',
        },
        queue,
        title: 'Treatments',
        stepName: 'treatments',
        kind: 'collection',
        collection: 'treatments',
        fileName: 'treatments',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 1,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    const res = makeRes()
    await seedAdvanceHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId },
      }) as PayloadRequest,
      res,
    )

    expect(res._status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('collection:treatments', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('surface:listing-comparison', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('surface:sitemap:pages', { expire: 0 })
    expect(revalidatePath).toHaveBeenCalledWith('/listing-comparison')
    expect(revalidatePath).toHaveBeenCalledWith('/pages-sitemap.xml')
  })

  it('does not flush a skipped public seed job that never wrote public work', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-skipped-public-empty'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    }) as SeedRunRecord
    record.status = 'completed'
    record.completedAt = '2026-07-08T10:00:00.000Z'
    record.completedJobs = 1
    record.succeededJobs = 0
    record.jobs = [
      {
        id: 'job-posts',
        order: 1,
        status: 'skipped',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'posts',
          kind: 'collection',
          collection: 'posts',
          fileName: 'posts',
        },
        queue,
        title: 'Posts',
        stepName: 'posts',
        kind: 'collection',
        collection: 'posts',
        fileName: 'posts',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 0,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    const res = makeRes()
    await seedAdvanceHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId },
      }) as PayloadRequest,
      res,
    )

    expect(res._status).toBe(200)
    expect((res._body as { finalFlush?: { status: string } }).finalFlush?.status).toBe('skipped')
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('does not flush rejected or cancelled seed runs with no public-affecting work', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-cancelled-private'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    }) as SeedRunRecord
    record.status = 'cancelled'
    record.completedAt = '2026-07-08T10:00:00.000Z'
    record.completedJobs = 1
    record.cancelledJobs = 1
    record.jobs = [
      {
        id: 'job-basic-users',
        order: 1,
        status: 'cancelled',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'basic-users',
          kind: 'collection',
          collection: 'basicUsers',
          fileName: 'basicUsers',
        },
        queue,
        title: 'Basic users',
        stepName: 'basic-users',
        kind: 'collection',
        collection: 'basicUsers',
        fileName: 'basicUsers',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 0,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    const res = makeRes()
    await seedAdvanceHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId },
      }) as PayloadRequest,
      res,
    )

    expect(res._status).toBe(200)
    expect((res._body as { finalFlush?: { status: string } }).finalFlush?.status).toBe('skipped')
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('does not flush while another runtime holds the database final-flush lock', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-cross-runtime-final-flush-lock'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    }) as SeedRunRecord
    record.status = 'completed'
    record.completedAt = '2026-07-08T10:00:00.000Z'
    record.completedJobs = 1
    record.succeededJobs = 1
    record.jobs = [
      {
        id: 'job-posts',
        order: 1,
        status: 'succeeded',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'posts',
          kind: 'collection',
          collection: 'posts',
          fileName: 'posts',
        },
        queue,
        title: 'Posts',
        stepName: 'posts',
        kind: 'collection',
        collection: 'posts',
        fileName: 'posts',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 1,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    const release = vi.fn()
    const query = vi.fn(async (text: string) => ({
      rows: text.includes('pg_try_advisory_lock') ? [{ acquired: false }] : [],
    }))
    ;(payload as typeof payload & { db: { pool: { connect: ReturnType<typeof vi.fn> } } }).db = {
      pool: {
        connect: vi.fn(async () => ({ query, release })),
      },
    }

    const res = makeRes()
    await seedAdvanceHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId },
      }) as PayloadRequest,
      res,
    )

    expect(res._status).toBe(200)
    expect((res._body as { finalFlush?: unknown }).finalFlush).toBeUndefined()
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(query).toHaveBeenCalledWith('select pg_try_advisory_lock(hashtext($1), hashtext($2)) as acquired', [
      'seed-final-flush',
      runId,
    ])
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('binds the pool while holding and releasing the database final-flush lock', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-database-final-flush-lock'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    }) as SeedRunRecord
    record.status = 'completed'
    record.completedAt = '2026-07-08T10:00:00.000Z'
    record.completedJobs = 1
    record.succeededJobs = 1
    record.jobs = [
      {
        id: 'job-posts',
        order: 1,
        status: 'succeeded',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'posts',
          kind: 'collection',
          collection: 'posts',
          fileName: 'posts',
        },
        queue,
        title: 'Posts',
        stepName: 'posts',
        kind: 'collection',
        collection: 'posts',
        fileName: 'posts',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 1,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    const release = vi.fn()
    const query = vi.fn(async (text: string) => ({
      rows: text.includes('pg_try_advisory_lock') ? [{ acquired: true }] : [],
    }))
    const poolMarker = Symbol('seed-final-flush-pool')
    const connect = vi.fn(async function (this: { marker?: symbol }) {
      if (this.marker !== poolMarker) {
        throw new Error('Database pool context was not preserved')
      }

      return { query, release }
    })
    const pool = { marker: poolMarker, connect }
    ;(payload as typeof payload & { db: { pool: { connect: ReturnType<typeof vi.fn> } } }).db = {
      pool,
    }

    await finalizeSeedRunPublicCaches(payload as unknown as Payload, {
      ...record,
      progress: { completed: 1, total: 1, percent: 100 },
      jobIds: ['job-posts'],
      hasActiveJob: false,
    })

    expect(revalidateTag).toHaveBeenCalled()
    expect(connect).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith('select pg_try_advisory_lock(hashtext($1), hashtext($2)) as acquired', [
      'seed-final-flush',
      runId,
    ])
    expect(query).toHaveBeenCalledWith('select pg_advisory_unlock(hashtext($1), hashtext($2))', [
      'seed-final-flush',
      runId,
    ])
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('guards final flush execution so concurrent terminal pollers do not both flush', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-concurrent-final-flush'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    }) as SeedRunRecord
    record.status = 'completed'
    record.completedAt = '2026-07-08T10:00:00.000Z'
    record.completedJobs = 1
    record.succeededJobs = 1
    record.jobs = [
      {
        id: 'job-posts',
        order: 1,
        status: 'succeeded',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'posts',
          kind: 'collection',
          collection: 'posts',
          fileName: 'posts',
        },
        queue,
        title: 'Posts',
        stepName: 'posts',
        kind: 'collection',
        collection: 'posts',
        fileName: 'posts',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 1,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('hold first flush while active')
    })

    await Promise.all([
      finalizeSeedRunPublicCaches(payload as unknown as Payload, {
        ...record,
        progress: { completed: 1, total: 1, percent: 100 },
        jobIds: ['job-posts'],
        hasActiveJob: false,
      }),
      finalizeSeedRunPublicCaches(payload as unknown as Payload, {
        ...record,
        progress: { completed: 1, total: 1, percent: 100 },
        jobIds: ['job-posts'],
        hasActiveJob: false,
      }),
    ])

    expect(revalidateTag).toHaveBeenCalledTimes(5)
  })
})
