import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import type { CollectionImportResult } from '@/endpoints/seed/utils/import-collection'
import type { SeedQueueJobInput } from '@/endpoints/seed/utils/job-types'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

const importCollection = vi.hoisted(() => vi.fn<() => Promise<CollectionImportResult>>())

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/endpoints/seed/utils/import-collection', () => ({ importCollection }))

import { seedChunkTask } from '@/endpoints/seed/tasks/seedChunkTask'
import { createSeedRunRecord, registerSeedRunJob, saveSeedRunRecord } from '@/endpoints/seed/utils/state'

describe('seedChunkTask', () => {
  beforeEach(() => {
    importCollection.mockReset()
    importCollection.mockResolvedValue({
      name: 'posts',
      created: 0,
      updated: 1,
      warnings: [],
      failures: [],
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('passes localized field metadata to collection imports', async () => {
    const payload = createMockPayload()
    const runId = 'seed-run-localized-posts'
    const queue = `seed:${runId}`
    const localizedFields = ['title', 'content', 'excerpt', 'meta.title', 'meta.description']
    const input: SeedQueueJobInput = {
      runId,
      type: 'demo',
      reset: false,
      queue,
      title: 'Posts',
      stepName: 'posts',
      kind: 'collection',
      collection: 'posts',
      fileName: 'posts',
      stableIds: ['11111111-1111-1111-1111-111111111111'],
      localizedFields,
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
      title: 'Posts',
      stepName: 'posts',
      kind: 'collection',
      collection: 'posts',
      fileName: 'posts',
      createdAt: '2026-05-04T12:00:00.000Z',
      created: 0,
      updated: 0,
      warnings: [],
      failures: [],
    })

    await seedChunkTask.handler({
      input,
      job: { id: 'job-1' },
      req: createMockReq(mockUsers.platform(), payload) as PayloadRequest,
    })

    expect(importCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        fileName: 'posts',
        localizedFields,
      }),
    )
  })

  it('blocks demo chunk execution in production before importing records', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const payload = createMockPayload()
    const runId = 'seed-run-production-demo'
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
      stableIds: ['seed-clinic-istanbul-bosphorus'],
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

    const result = await seedChunkTask.handler({
      input,
      job: { id: 'job-1' },
      req: createMockReq(mockUsers.platform(), payload) as PayloadRequest,
    })

    expect(result).toEqual({
      state: 'failed',
      errorMessage: 'Demo seeding is disabled in production runtime',
    })
    expect(importCollection).not.toHaveBeenCalled()
  })
})
