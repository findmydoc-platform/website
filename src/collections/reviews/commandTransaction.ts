import type { PayloadRequest } from 'payload'

const MAX_TRANSACTION_ATTEMPTS = 3

const TRANSACTION_OPTIONS = {
  accessMode: 'read write',
  isolationLevel: 'serializable',
} as const

export class ReviewCommandTransactionUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReviewCommandTransactionUnavailableError'
  }
}

const errorRecord = (error: unknown): Record<string, unknown> | null =>
  error !== null && (typeof error === 'object' || typeof error === 'function')
    ? (error as Record<string, unknown>)
    : null

export const isSerializationFailure = (error: unknown): boolean => {
  const visited = new Set<unknown>()
  let current: unknown = error

  while (current !== null && typeof current !== 'undefined' && !visited.has(current)) {
    visited.add(current)
    const record = errorRecord(current)
    if (!record) return false

    if (record.code === '40001' || record.sqlState === '40001' || record.sqlstate === '40001') {
      return true
    }

    current = record.cause
  }

  return false
}

const clearOwnedTransaction = (req: PayloadRequest, transactionID: number | string): void => {
  if (req.transactionID === transactionID) {
    delete req.transactionID
  }
}

export const runReviewCommandTransaction = async <Result>(
  req: PayloadRequest,
  command: () => Promise<Result>,
): Promise<Result> => {
  if (typeof req.transactionID !== 'undefined') {
    throw new ReviewCommandTransactionUnavailableError('Review commands cannot run inside a pre-existing transaction.')
  }

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    let transactionID: null | number | string = null

    try {
      transactionID = await req.payload.db.beginTransaction(TRANSACTION_OPTIONS)
      if (transactionID === null) {
        throw new ReviewCommandTransactionUnavailableError(
          'The database adapter did not start a review command transaction.',
        )
      }

      req.transactionID = transactionID
      const result = await command()
      await req.payload.db.commitTransaction(transactionID)
      return result
    } catch (error: unknown) {
      if (transactionID !== null) {
        try {
          await req.payload.db.rollbackTransaction(transactionID)
        } catch (rollbackError: unknown) {
          throw new AggregateError([error, rollbackError], 'Review command transaction and rollback both failed.', {
            cause: error,
          })
        }
      }

      if (isSerializationFailure(error) && attempt < MAX_TRANSACTION_ATTEMPTS) {
        continue
      }

      throw error
    } finally {
      if (transactionID !== null) {
        clearOwnedTransaction(req, transactionID)
      }
    }
  }

  throw new ReviewCommandTransactionUnavailableError('Review command transaction attempts were exhausted.')
}
