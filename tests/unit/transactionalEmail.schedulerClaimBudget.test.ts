import type { PayloadRequest } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'

const transaction = vi.hoisted(() => vi.fn())
vi.mock('@/features/transactionalEmail/workerStorage', () => ({ workerTransaction: transaction }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('scheduler claim budget at the storage boundary', () => {
  it('does not write a lease when reading the row consumes the remaining budget', async () => {
    vi.stubEnv('VERCEL_ENV', 'test')
    let clock = 0
    const write = vi.fn()
    transaction.mockImplementation(async (_req, _authority, work) =>
      work({
        read: async () => {
          clock = 215_001
          return {
            runtimeEnvironment: 'test',
            state: 'queued',
            leaseExpiresAt: null,
            nextAttemptAt: null,
            attemptCount: 0,
            lastAttemptAt: null,
          }
        },
        write,
      }),
    )
    const worker = createTransactionalEmailWorker({} as PayloadRequest, { now: () => clock })
    const claim = await worker.claimForBatch('1', () => 240_000 - clock > 25_000)
    expect(claim).toBeNull()
    expect(write).not.toHaveBeenCalled()
  })
})
