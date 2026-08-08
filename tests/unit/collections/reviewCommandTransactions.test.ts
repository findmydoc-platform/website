import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ReviewCommandTransactionUnavailableError,
  runReviewCommandTransaction,
} from '@/collections/reviews/commandTransaction'
import { reviewModerationPostHandler, reviewWithdrawPostHandler } from '@/collections/reviews/endpoints'

type ReviewRevalidationDispatchArgs = {
  readonly doc: unknown
  readonly previousDoc?: unknown
  readonly req: PayloadRequest
}

const hookMocks = vi.hoisted(() => ({
  dispatchReviewChangeRevalidation: vi.fn(async (_args: ReviewRevalidationDispatchArgs) => undefined),
}))

vi.mock('@/hooks/revalidateClinicSurfaces', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/revalidateClinicSurfaces')>()
  return {
    ...original,
    dispatchReviewChangeRevalidation: hookMocks.dispatchReviewChangeRevalidation,
  }
})

const serializableFailure = (): Error =>
  new Error('transaction failed', {
    cause: new Error('driver failed', { cause: { code: '40001' } }),
  })

const transactionRequest = ({
  beginTransaction = vi.fn(async () => 'tx-1'),
  commitTransaction = vi.fn(async () => undefined),
  rollbackTransaction = vi.fn(async () => undefined),
}: {
  beginTransaction?: ReturnType<typeof vi.fn>
  commitTransaction?: ReturnType<typeof vi.fn>
  rollbackTransaction?: ReturnType<typeof vi.fn>
} = {}) =>
  ({
    payload: {
      db: { beginTransaction, commitTransaction, rollbackTransaction },
    },
  }) as unknown as PayloadRequest

const deferred = <Value = void>() => {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  const promise = new Promise<Value>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  hookMocks.dispatchReviewChangeRevalidation.mockResolvedValue(undefined)
})

describe('review command transaction control', () => {
  it('retries serialization failures in fresh serializable read-write transactions', async () => {
    const transactionIDs = ['tx-1', 'tx-2', 'tx-3']
    const beginTransaction = vi.fn(async () => transactionIDs.shift() ?? null)
    const commitTransaction = vi.fn(async () => undefined)
    const rollbackTransaction = vi.fn(async () => undefined)
    const req = transactionRequest({ beginTransaction, commitTransaction, rollbackTransaction })
    const seenTransactionIDs: unknown[] = []

    const result = await runReviewCommandTransaction(req, async () => {
      seenTransactionIDs.push(req.transactionID)
      if (seenTransactionIDs.length < 3) throw serializableFailure()
      return 'committed'
    })

    expect(result).toBe('committed')
    expect(seenTransactionIDs).toEqual(['tx-1', 'tx-2', 'tx-3'])
    expect(beginTransaction).toHaveBeenCalledTimes(3)
    expect(beginTransaction).toHaveBeenCalledWith({
      accessMode: 'read write',
      isolationLevel: 'serializable',
    })
    expect(rollbackTransaction.mock.calls).toEqual([['tx-1'], ['tx-2']])
    expect(commitTransaction).toHaveBeenCalledOnce()
    expect(commitTransaction).toHaveBeenCalledWith('tx-3')
    expect(req.transactionID).toBeUndefined()
  })

  it('rolls back once and does not retry a non-serialization database failure', async () => {
    const beginTransaction = vi.fn(async () => 'tx-1')
    const commitTransaction = vi.fn(async () => undefined)
    const rollbackTransaction = vi.fn(async () => undefined)
    const req = transactionRequest({ beginTransaction, commitTransaction, rollbackTransaction })
    const databaseFailure = Object.assign(new Error('constraint failed'), { code: '23505' })

    await expect(
      runReviewCommandTransaction(req, async () => {
        throw databaseFailure
      }),
    ).rejects.toBe(databaseFailure)

    expect(beginTransaction).toHaveBeenCalledOnce()
    expect(commitTransaction).not.toHaveBeenCalled()
    expect(rollbackTransaction).toHaveBeenCalledWith('tx-1')
    expect(req.transactionID).toBeUndefined()
  })

  it('stops after three serialization failures and rolls every attempt back', async () => {
    let sequence = 0
    const beginTransaction = vi.fn(async () => `tx-${++sequence}`)
    const commitTransaction = vi.fn(async () => undefined)
    const rollbackTransaction = vi.fn(async () => undefined)
    const req = transactionRequest({ beginTransaction, commitTransaction, rollbackTransaction })

    await expect(
      runReviewCommandTransaction(req, async () => {
        throw serializableFailure()
      }),
    ).rejects.toMatchObject({ cause: { cause: { code: '40001' } } })

    expect(beginTransaction).toHaveBeenCalledTimes(3)
    expect(commitTransaction).not.toHaveBeenCalled()
    expect(rollbackTransaction.mock.calls).toEqual([['tx-1'], ['tx-2'], ['tx-3']])
    expect(req.transactionID).toBeUndefined()
  })

  it('rejects a pre-existing transaction without taking ownership of it', async () => {
    const beginTransaction = vi.fn(async () => 'tx-1')
    const req = transactionRequest({ beginTransaction })
    req.transactionID = 'outer-transaction'

    await expect(runReviewCommandTransaction(req, async () => 'unused')).rejects.toBeInstanceOf(
      ReviewCommandTransactionUnavailableError,
    )

    expect(beginTransaction).not.toHaveBeenCalled()
    expect(req.transactionID).toBe('outer-transaction')
  })
})

describe('review command endpoint concurrency', () => {
  it('keeps withdrawal terminal when it commits before stale moderation', async () => {
    const firstModerationRead = deferred()
    const releaseModeration = deferred()
    const stagedReviews = new Map<string, Record<string, unknown>>()
    const committedWrites: string[] = []
    const lifecycle: string[] = []
    let transactionSequence = 0
    let committedReview: Record<string, unknown> = {
      id: 42,
      patient: 7,
      publicComment: null,
      publicMeasure: 'none',
      publicNotice: null,
      withdrawalSource: null,
      withdrawalState: 'active',
      withdrawnAt: null,
    }

    const beginTransaction = vi.fn(async () => `tx-${++transactionSequence}`)
    const commitTransaction = vi.fn(async (transactionID: string) => {
      lifecycle.push(`commit:${transactionID}`)
      if (transactionID === 'tx-1') throw serializableFailure()

      const staged = stagedReviews.get(transactionID)
      if (staged) {
        committedReview = staged
        committedWrites.push(staged.withdrawalState === 'withdrawn' ? 'withdrawal' : 'moderation')
        stagedReviews.delete(transactionID)
      }
    })
    const rollbackTransaction = vi.fn(async (transactionID: string) => {
      stagedReviews.delete(transactionID)
    })
    const findByID = vi.fn(async ({ disableErrors, req }: { disableErrors?: boolean; req: PayloadRequest }) => {
      expect(disableErrors).toBe(true)
      const transactionID = String(req.transactionID)
      const snapshot = { ...committedReview }

      if (transactionID === 'tx-1') {
        firstModerationRead.resolve()
        await releaseModeration.promise
      }

      return snapshot
    })
    const update = vi.fn(
      async ({
        context,
        data,
        req,
      }: {
        context?: Record<string, unknown>
        data: Record<string, unknown>
        req: PayloadRequest
      }) => {
        expect(context).toEqual({ disableRevalidate: true })
        const transactionID = String(req.transactionID)
        const staged = { ...committedReview, ...data }
        stagedReviews.set(transactionID, staged)
        return staged
      },
    )
    const logger = { error: vi.fn() }
    const payload = {
      db: { beginTransaction, commitTransaction, rollbackTransaction },
      findByID,
      logger,
      update,
    }
    const request = (user: { collection: 'patients' | 'platformStaff'; id: number }, body: Record<string, unknown>) =>
      ({
        json: vi.fn(async () => body),
        payload,
        routeParams: { id: 42 },
        user,
      }) as unknown as PayloadRequest

    hookMocks.dispatchReviewChangeRevalidation.mockImplementation(async ({ req }) => {
      expect(req.transactionID).toBeUndefined()
      lifecycle.push('dispatch')
    })

    const moderationReq = request(
      { collection: 'platformStaff', id: 11 },
      { measure: 'removed', reason: 'Moderation based on the stale active state.' },
    )
    const withdrawalReq = request({ collection: 'patients', id: 7 }, {})

    const moderation = reviewModerationPostHandler(moderationReq)
    await firstModerationRead.promise

    const withdrawalResponse = await reviewWithdrawPostHandler(withdrawalReq)
    expect(withdrawalResponse.status).toBe(200)
    expect(hookMocks.dispatchReviewChangeRevalidation).toHaveBeenCalledOnce()
    expect(hookMocks.dispatchReviewChangeRevalidation).toHaveBeenCalledWith({
      doc: expect.objectContaining({ withdrawalState: 'withdrawn' }),
      previousDoc: expect.objectContaining({ withdrawalState: 'active' }),
      req: withdrawalReq,
    })
    expect(lifecycle.indexOf('commit:tx-2')).toBeLessThan(lifecycle.indexOf('dispatch'))

    releaseModeration.resolve()
    const moderationResponse = await moderation

    expect(moderationResponse.status).toBe(409)
    await expect(moderationResponse.json()).resolves.toEqual({
      error: { code: 'REVIEW_WITHDRAWN' },
    })
    expect(committedReview).toMatchObject({
      publicMeasure: 'none',
      withdrawalState: 'withdrawn',
    })
    expect(committedWrites).toEqual(['withdrawal'])
    expect(hookMocks.dispatchReviewChangeRevalidation).toHaveBeenCalledOnce()

    const repeatedWithdrawal = await reviewWithdrawPostHandler(request({ collection: 'patients', id: 7 }, {}))
    expect(repeatedWithdrawal.status).toBe(200)
    expect(hookMocks.dispatchReviewChangeRevalidation).toHaveBeenCalledOnce()

    expect(beginTransaction).toHaveBeenCalledTimes(4)
    expect(findByID).toHaveBeenCalledTimes(4)
    expect(update).toHaveBeenCalledTimes(2)
    expect(rollbackTransaction).toHaveBeenCalledWith('tx-1')
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('maps a database read failure to unavailable instead of not found', async () => {
    const beginTransaction = vi.fn(async () => 'tx-1')
    const commitTransaction = vi.fn(async () => undefined)
    const rollbackTransaction = vi.fn(async () => undefined)
    const logger = { error: vi.fn() }
    const update = vi.fn()
    const req = {
      json: vi.fn(async () => ({ measure: 'none', reason: 'No public change.' })),
      payload: {
        db: { beginTransaction, commitTransaction, rollbackTransaction },
        findByID: vi.fn(async () => {
          throw Object.assign(new Error('database unavailable'), { code: '08006' })
        }),
        logger,
        update,
      },
      routeParams: { id: 42 },
      user: { collection: 'platformStaff', id: 11 },
    } as unknown as PayloadRequest

    const response = await reviewModerationPostHandler(req)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: { code: 'UNAVAILABLE' } })
    expect(rollbackTransaction).toHaveBeenCalledWith('tx-1')
    expect(commitTransaction).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledOnce()
    expect(hookMocks.dispatchReviewChangeRevalidation).not.toHaveBeenCalled()
  })

  it('maps exhausted serialization retries to unavailable', async () => {
    let transactionSequence = 0
    const beginTransaction = vi.fn(async () => `tx-${++transactionSequence}`)
    const commitTransaction = vi.fn(async () => undefined)
    const rollbackTransaction = vi.fn(async () => undefined)
    const update = vi.fn(async () => {
      throw serializableFailure()
    })
    const logger = { error: vi.fn() }
    const req = {
      json: vi.fn(async () => ({ measure: 'none', reason: 'No public change.' })),
      payload: {
        db: { beginTransaction, commitTransaction, rollbackTransaction },
        findByID: vi.fn(async () => ({ id: 42, publicMeasure: 'none', withdrawalState: 'active' })),
        logger,
        update,
      },
      routeParams: { id: 42 },
      user: { collection: 'platformStaff', id: 11 },
    } as unknown as PayloadRequest

    const response = await reviewModerationPostHandler(req)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: { code: 'UNAVAILABLE' } })
    expect(beginTransaction).toHaveBeenCalledTimes(3)
    expect(update).toHaveBeenCalledTimes(3)
    expect(rollbackTransaction).toHaveBeenCalledTimes(3)
    expect(commitTransaction).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledOnce()
    expect(req.transactionID).toBeUndefined()
    expect(hookMocks.dispatchReviewChangeRevalidation).not.toHaveBeenCalled()
  })
})
