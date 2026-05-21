import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

type MockResponse = {
  _status?: number
  _body: Record<string, unknown>
  status: (code: number) => MockResponse
  json: (body: unknown) => MockResponse
}

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { seedAdvanceHandler, seedPostHandler, seedRetryHandler } from '@/endpoints/seed/seedEndpoint'
import { createSeedRunRecord, registerSeedRunJob, saveSeedRunRecord } from '@/endpoints/seed/utils/state'
import type { SeedQueueJobInput } from '@/endpoints/seed/utils/job-types'

function makeReq(
  query: Record<string, unknown>,
  user: ReturnType<typeof mockUsers.platform> | ReturnType<typeof mockUsers.clinic> = mockUsers.platform(),
): PayloadRequest {
  return createMockReq(user, createMockPayload(), { query }) as PayloadRequest
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

describe('production seed guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows baseline seeding in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const res = makeRes()
    await seedPostHandler(makeReq({ type: 'baseline' }), res)

    expect(res._status).toBe(202)
    expect(res._body.type).toBe('baseline')
    expect(res._body.reset).toBe(false)
  })

  it('blocks baseline reset seeding in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const res = makeRes()
    await seedPostHandler(makeReq({ type: 'baseline', reset: '1' }), res)

    expect(res._status).toBe(400)
    expect(res._body.error).toBe('Seed reset is disabled in this runtime')
  })

  it.each([
    { label: 'demo seeding', query: { type: 'demo' } },
    { label: 'demo reset seeding', query: { type: 'demo', reset: '1' } },
  ])('blocks $label in production', async ({ query }) => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const res = makeRes()
    await seedPostHandler(makeReq(query), res)

    expect(res._status).toBe(400)
    expect(res._body.error).toBe('Demo seeding is disabled in production runtime')
  })

  it('blocks non-platform users before runtime policy checks', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const res = makeRes()
    await seedPostHandler(makeReq({ type: 'baseline' }, mockUsers.clinic()), res)

    expect(res._status).toBe(403)
    expect(res._body.error).toBe('Forbidden')
  })

  it('blocks retrying stale demo seed runs in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const payload = createMockPayload()
    const runId = 'stale-demo-run'
    const queue = `seed:${runId}`
    const input: SeedQueueJobInput = {
      runId,
      type: 'demo',
      reset: false,
      queue,
      title: 'Clinics',
      stepName: 'clinics',
      kind: 'collection',
      collection: 'clinics',
      fileName: 'clinics',
    }
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    })
    record.status = 'partial'
    record.jobs = [
      {
        id: 'job-1',
        order: 1,
        status: 'failed',
        input,
        queue,
        title: 'Clinics',
        stepName: 'clinics',
        kind: 'collection',
        collection: 'clinics',
        fileName: 'clinics',
        createdAt: '2026-05-20T10:00:00.000Z',
        created: 0,
        updated: 0,
        warnings: [],
        failures: ['previous failure'],
      },
    ]
    await saveSeedRunRecord(payload as unknown as Payload, record)

    const res = makeRes()
    await seedRetryHandler(createMockReq(mockUsers.platform(), payload, { query: { runId } }) as PayloadRequest, res)

    expect(res._status).toBe(400)
    expect(res._body.error).toBe('Demo seeding is disabled in production runtime')
    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })

  it('blocks advancing stale demo seed runs in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const payload = createMockPayload()
    const runId = 'stale-demo-advance-run'
    const queue = `seed:${runId}`
    const input: SeedQueueJobInput = {
      runId,
      type: 'demo',
      reset: false,
      queue,
      title: 'Clinics',
      stepName: 'clinics',
      kind: 'collection',
      collection: 'clinics',
      fileName: 'clinics',
    }
    const record = createSeedRunRecord({
      runId,
      type: 'demo',
      reset: false,
      queue,
      totalJobs: 1,
    })
    await saveSeedRunRecord(payload as unknown as Payload, record)
    await registerSeedRunJob(payload as unknown as Payload, runId, {
      id: 'job-1',
      order: 1,
      status: 'queued',
      input,
      queue,
      title: 'Clinics',
      stepName: 'clinics',
      kind: 'collection',
      collection: 'clinics',
      fileName: 'clinics',
      createdAt: '2026-05-20T10:00:00.000Z',
      created: 0,
      updated: 0,
      warnings: [],
      failures: [],
    })

    const res = makeRes()
    await seedAdvanceHandler(createMockReq(mockUsers.platform(), payload, { query: { runId } }) as PayloadRequest, res)

    expect(res._status).toBe(400)
    expect(res._body.error).toBe('Demo seeding is disabled in production runtime')
    expect(payload.jobs.run).not.toHaveBeenCalled()
    expect(payload.jobs.cancel).toHaveBeenCalledWith(
      expect.objectContaining({
        queue,
        overrideAccess: true,
      }),
    )
  })

  it('queues baseline seeding in development runtime', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', '')
    vi.stubEnv('NODE_ENV', 'development')

    const res = makeRes()
    await seedPostHandler(makeReq({ type: 'baseline' }), res)

    expect(res._status).toBe(202)
    expect(res._body.type).toBe('baseline')
  })
})
