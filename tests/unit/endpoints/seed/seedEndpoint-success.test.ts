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
          output: {
            affectedPostSlugs: ['old-demo-post', 'new-editorial-post'],
          },
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
        pathCount: 6,
      })
      expect(revalidateTag).toHaveBeenCalledWith('collection:posts', { expire: 0 })
      expect(revalidateTag).toHaveBeenCalledWith('surface:posts-list', { expire: 0 })
      expect(revalidateTag).toHaveBeenCalledWith('surface:sitemap:posts', { expire: 0 })
      expect(revalidatePath).toHaveBeenCalledWith('/posts')
      expect(revalidatePath).toHaveBeenCalledWith('/posts-sitemap.xml')
      expect(revalidatePath).toHaveBeenCalledWith('/posts/old-demo-post')
      expect(revalidatePath).toHaveBeenCalledWith('/posts/new-editorial-post')

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

  it.each(['demo', 'baseline'] as const)(
    'flushes the prepared public scope after a %s reset fails mid-delete',
    async (seedType) => {
      const { payload } = makePayloadReq({})
      payload.find.mockResolvedValue({ docs: [], hasNextPage: false })
      const runId = `seed-run-failed-${seedType}-reset-with-public-work`
      const queue = `seed:${runId}`
      const record = createSeedRunRecord({
        runId,
        type: seedType,
        reset: true,
        queue,
        totalJobs: 1,
      }) as SeedRunRecord
      record.status = 'failed'
      record.completedAt = '2026-08-16T10:00:00.000Z'
      record.completedJobs = 1
      record.failedJobs = 1
      record.jobs = [
        {
          id: 'job-reset',
          order: 1,
          status: 'failed',
          input: {
            runId,
            type: seedType,
            reset: true,
            queue,
            stepName: 'reset',
            kind: 'reset',
          },
          queue,
          title: 'Reset demo data',
          stepName: 'reset',
          kind: 'reset',
          createdAt: '2026-08-16T09:00:00.000Z',
          completedAt: '2026-08-16T10:00:00.000Z',
          created: 0,
          updated: 0,
          warnings: [],
          failures: ['doctor delete failed'],
          output: {
            affectedPostSlugs: ['retired-post'],
            publicWorkStarted: true,
          },
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
      expect((res._body as { finalFlush?: { status: string } }).finalFlush).toMatchObject({ status: 'executed' })
      expect(revalidateTag).toHaveBeenCalledWith('collection:posts', { expire: 0 })
      expect(revalidateTag).toHaveBeenCalledWith('collection:doctors', { expire: 0 })
      expect(revalidatePath).toHaveBeenCalledWith('/posts/retired-post')
      if (seedType === 'baseline') {
        expect(revalidateTag).toHaveBeenCalledWith('collection:medical-specialties', { expire: 0 })
      }
    },
  )

  it('does not flush an interim public snapshot from an incomplete atomic seed group', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-incomplete-review-history'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 4,
    }) as SeedRunRecord
    record.status = 'partial'
    record.completedAt = '2026-08-11T10:00:00.000Z'
    record.completedJobs = 4
    record.succeededJobs = 2
    record.failedJobs = 1
    record.cancelledJobs = 1
    record.jobs = [
      {
        id: 'job-appeal-initial',
        order: 1,
        status: 'succeeded',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'review-appeals-initial-history',
          kind: 'collection',
          atomicGroup: 'review-moderation-history',
          collection: 'reviewAppeals',
          fileName: 'reviewAppealsInitial',
        },
        queue,
        stepName: 'review-appeals-initial-history',
        kind: 'collection',
        collection: 'reviewAppeals',
        fileName: 'reviewAppealsInitial',
        createdAt: '2026-08-11T09:00:00.000Z',
        completedAt: '2026-08-11T09:01:00.000Z',
        created: 2,
        updated: 0,
        warnings: [],
        failures: [],
      },
      {
        id: 'job-moderation-initial',
        order: 2,
        status: 'succeeded',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'review-moderations-initial-history',
          kind: 'collection',
          atomicGroup: 'review-moderation-history',
          collection: 'reviews',
          fileName: 'reviewModerationsInitial',
        },
        queue,
        stepName: 'review-moderations-initial-history',
        kind: 'collection',
        collection: 'reviews',
        fileName: 'reviewModerationsInitial',
        createdAt: '2026-08-11T09:01:00.000Z',
        completedAt: '2026-08-11T09:02:00.000Z',
        created: 0,
        updated: 2,
        warnings: [],
        failures: [],
      },
      {
        id: 'job-moderation-final',
        order: 3,
        status: 'failed',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'review-moderations-final-state',
          kind: 'collection',
          atomicGroup: 'review-moderation-history',
          collection: 'reviews',
          fileName: 'reviewModerations',
        },
        queue,
        stepName: 'review-moderations-final-state',
        kind: 'collection',
        collection: 'reviews',
        fileName: 'reviewModerations',
        createdAt: '2026-08-11T09:02:00.000Z',
        completedAt: '2026-08-11T09:03:00.000Z',
        created: 0,
        updated: 0,
        warnings: [],
        failures: ['final moderation failed'],
      },
      {
        id: 'job-appeal-final',
        order: 4,
        status: 'cancelled',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'review-appeals-final-state',
          kind: 'collection',
          atomicGroup: 'review-moderation-history',
          collection: 'reviewAppeals',
          fileName: 'reviewAppeals',
        },
        queue,
        stepName: 'review-appeals-final-state',
        kind: 'collection',
        collection: 'reviewAppeals',
        fileName: 'reviewAppeals',
        createdAt: '2026-08-11T09:03:00.000Z',
        completedAt: '2026-08-11T09:04:00.000Z',
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
    expect((res._body as { finalFlush?: { reason?: string; status: string } }).finalFlush).toMatchObject({
      status: 'skipped',
      reason: 'incomplete-atomic-group',
    })
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('flushes independent public work while withholding an incomplete review history scope', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-mixed-incomplete-review-history'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 6,
    }) as SeedRunRecord
    const makeJob = (args: {
      id: string
      order: number
      status: 'succeeded' | 'failed' | 'queued'
      stepName: string
      collection: 'posts' | 'clinics' | 'reviewAppeals' | 'reviews'
      fileName: string
      atomicGroup?: string
      created?: number
      updated?: number
    }): SeedRunRecord['jobs'][number] => ({
      id: args.id,
      order: args.order,
      status: args.status,
      input: {
        runId,
        type: 'demo',
        reset: false,
        queue,
        stepName: args.stepName,
        kind: 'collection',
        ...(args.atomicGroup ? { atomicGroup: args.atomicGroup } : {}),
        collection: args.collection,
        fileName: args.fileName,
      },
      queue,
      stepName: args.stepName,
      kind: 'collection',
      collection: args.collection,
      fileName: args.fileName,
      createdAt: '2026-08-11T09:00:00.000Z',
      ...(args.status === 'queued' ? {} : { completedAt: '2026-08-11T10:00:00.000Z' }),
      created: args.created ?? 0,
      updated: args.updated ?? 0,
      warnings: [],
      failures: args.status === 'failed' ? ['final moderation failed'] : [],
    })

    record.status = 'partial'
    record.completedAt = '2026-08-11T10:00:00.000Z'
    record.completedJobs = 5
    record.succeededJobs = 4
    record.failedJobs = 1
    record.jobs = [
      makeJob({
        id: 'job-posts',
        order: 1,
        status: 'succeeded',
        stepName: 'posts',
        collection: 'posts',
        fileName: 'posts',
        created: 1,
      }),
      makeJob({
        id: 'job-clinics',
        order: 2,
        status: 'succeeded',
        stepName: 'clinics',
        collection: 'clinics',
        fileName: 'clinics',
        created: 1,
      }),
      makeJob({
        id: 'job-appeal-initial',
        order: 3,
        status: 'succeeded',
        stepName: 'review-appeals-initial-history',
        collection: 'reviewAppeals',
        fileName: 'reviewAppealsInitial',
        atomicGroup: 'review-moderation-history',
        updated: 1,
      }),
      makeJob({
        id: 'job-moderation-initial',
        order: 4,
        status: 'succeeded',
        stepName: 'review-moderations-initial-history',
        collection: 'reviews',
        fileName: 'reviewModerationsInitial',
        atomicGroup: 'review-moderation-history',
        updated: 1,
      }),
      makeJob({
        id: 'job-moderation-final',
        order: 5,
        status: 'failed',
        stepName: 'review-moderations-final-state',
        collection: 'reviews',
        fileName: 'reviewModerations',
        atomicGroup: 'review-moderation-history',
      }),
      makeJob({
        id: 'job-appeal-final',
        order: 6,
        status: 'queued',
        stepName: 'review-appeals-final-state',
        collection: 'reviewAppeals',
        fileName: 'reviewAppeals',
        atomicGroup: 'review-moderation-history',
      }),
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    const res = makeRes()
    await seedAdvanceHandler(createMockReq(mockUsers.platform(), payload, { query: { runId } }) as PayloadRequest, res)

    expect(res._status).toBe(200)
    expect((res._body as { finalFlush?: { reason?: string; status: string } }).finalFlush).toMatchObject({
      status: 'executed',
      reason: 'incomplete-atomic-group',
    })
    expect(revalidateTag).toHaveBeenCalledWith('collection:posts', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('surface:posts-list', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('surface:sitemap:posts', { expire: 0 })
    expect(revalidatePath).toHaveBeenCalledWith('/posts')
    expect(revalidatePath).toHaveBeenCalledWith('/posts-sitemap.xml')
    expect(revalidateTag).not.toHaveBeenCalledWith('collection:clinics', { expire: 0 })
    expect(revalidateTag).not.toHaveBeenCalledWith('collection:reviews', { expire: 0 })
    expect(revalidateTag).not.toHaveBeenCalledWith('surface:clinic-detail', { expire: 0 })
    expect(revalidateTag).not.toHaveBeenCalledWith('surface:listing-comparison', { expire: 0 })
    expect(revalidateTag).not.toHaveBeenCalledWith('surface:sitemap:pages', { expire: 0 })
    expect(revalidatePath).not.toHaveBeenCalledWith('/listing-comparison')
    expect(revalidatePath).not.toHaveBeenCalledWith('/pages-sitemap.xml')
  })

  it('flushes published platform content media consumers after a seed write', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-platform-content-media'
    const queue = `seed:${runId}`
    const record = createSeedRunRecord({
      runId,
      type: 'baseline',
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
        id: 'job-platform-content-media',
        order: 1,
        status: 'succeeded',
        input: {
          runId,
          type: 'baseline',
          reset: false,
          queue,
          stepName: 'platform-content-media',
          kind: 'collection',
          collection: 'platformContentMedia',
          fileName: 'platformContentMedia',
        },
        queue,
        title: 'Platform content media',
        stepName: 'platform-content-media',
        kind: 'collection',
        collection: 'platformContentMedia',
        fileName: 'platformContentMedia',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 1,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ]
    payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'pages') {
        return { docs: [{ slug: 'about' }, { slug: 'editorial' }], hasNextPage: false }
      }
      return { docs: [{ slug: 'old-post' }, { slug: 'new-post' }], hasNextPage: false }
    })
    await saveSeedRunRecord(payload as unknown as Payload, record)

    await finalizeSeedRunPublicCaches(payload as unknown as Payload, {
      ...record,
      progress: { completed: 1, total: 1, percent: 100 },
      jobIds: ['job-platform-content-media'],
      hasActiveJob: false,
    })

    expect(revalidateTag).toHaveBeenCalledWith('collection:pages', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('collection:posts', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('global:landingPages', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('surface:sitemap:pages', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('surface:sitemap:posts', { expire: 0 })
    expect(revalidatePath).toHaveBeenCalledWith('/about')
    expect(revalidatePath).toHaveBeenCalledWith('/editorial')
    expect(revalidatePath).toHaveBeenCalledWith('/posts/old-post')
    expect(revalidatePath).toHaveBeenCalledWith('/posts/new-post')
  })

  it('retries a failed terminal seed final flush with at-least-once invalidation', async () => {
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
    expect(revalidateTag).toHaveBeenCalledWith('surface:posts-list', { expire: 0 })
    expect(revalidatePath).toHaveBeenCalledWith('/posts')

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
    expect(vi.mocked(revalidateTag).mock.calls.filter(([tag]) => tag === 'surface:posts-list')).toHaveLength(2)
    expect(vi.mocked(revalidatePath).mock.calls.filter(([path]) => path === '/posts')).toHaveLength(2)
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

  it('keeps appeal seed jobs private and skips the public cache flush', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-review-appeal-public-transition'
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
        id: 'job-review-appeals',
        order: 1,
        status: 'succeeded',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'review-appeals-final-state',
          kind: 'collection',
          collection: 'reviewAppeals',
          fileName: 'reviewAppeals',
        },
        queue,
        title: 'Review appeals final state',
        stepName: 'review-appeals-final-state',
        kind: 'collection',
        collection: 'reviewAppeals',
        fileName: 'reviewAppeals',
        createdAt: '2026-07-08T09:00:00.000Z',
        completedAt: '2026-07-08T10:00:00.000Z',
        created: 0,
        updated: 1,
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
    expect((res._body as { finalFlush?: { reason?: string; status: string } }).finalFlush).toMatchObject({
      status: 'skipped',
      reason: 'no-public-work',
    })
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
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
        id: 'job-patients',
        order: 1,
        status: 'cancelled',
        input: {
          runId,
          type: 'demo',
          reset: false,
          queue,
          stepName: 'patients',
          kind: 'collection',
          collection: 'patients',
          fileName: 'patients',
        },
        queue,
        title: 'Patients',
        stepName: 'patients',
        kind: 'collection',
        collection: 'patients',
        fileName: 'patients',
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

  it('runs the final flush without accessing the Payload database adapter', async () => {
    const { payload } = makePayloadReq({})
    const runId = 'seed-run-without-database-adapter'
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

    const databaseAdapterAccess = vi.fn(() => {
      throw new Error('Payload database adapter must not be accessed')
    })
    Object.defineProperty(payload, 'db', { configurable: true, get: databaseAdapterAccess })

    const res = makeRes()
    await seedAdvanceHandler(
      createMockReq(mockUsers.platform(), payload, {
        query: { runId },
      }) as PayloadRequest,
      res,
    )

    expect(res._status).toBe(200)
    expect((res._body as { finalFlush?: { status: string } }).finalFlush?.status).toBe('executed')
    expect(revalidateTag).toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalled()
    expect(databaseAdapterAccess).not.toHaveBeenCalled()
  })

  it('keeps a best-effort in-process guard for concurrent terminal pollers', async () => {
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
