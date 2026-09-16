import { createLocalReq, ValidationError, type PayloadRequest } from 'payload'
import { TransactionalEmailError } from './errors'

const maximumTransactionAttempts = 3

export function isActiveTransaction(req: PayloadRequest, transactionID: unknown): transactionID is number | string {
  // The native adapter silently falls back to autocommit for missing sessions.
  // Inspect only its documented session registry; all reads and writes still use Payload's Local API.
  return (
    (typeof transactionID === 'string' || typeof transactionID === 'number') &&
    Boolean(transactionID) &&
    Boolean(req.payload.db.sessions && Object.hasOwn(req.payload.db.sessions, transactionID))
  )
}

export function transactionError(error: unknown): TransactionalEmailError {
  if (error instanceof TransactionalEmailError) return error
  const visited = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current)
    const detail = current as Record<string, unknown>
    if (
      detail.code === '40001' ||
      detail.code === '40P01' ||
      (detail.code === '23505' &&
        [
          'commandType_operationReference_idx',
          'transactional_email_events_provider_event_id_idx',
          'outbox_sequence_idx',
        ].includes(String(detail.constraint)))
    ) {
      return new TransactionalEmailError('transaction-conflict')
    }
    if (
      current instanceof ValidationError &&
      ((current.data.collection === 'transactionalEmailEvents' &&
        current.data.errors.some(
          ({ path, tableName }) =>
            tableName === 'transactional_email_events' && ['provider_event_id', 'outbox_id, sequence'].includes(path),
        )) ||
        (current.data.collection === 'transactionalEmailOutbox' &&
          current.data.errors.some(
            ({ path, tableName }) =>
              tableName === 'transactional_email_outbox' && path === 'command_type, operation_reference',
          )))
    ) {
      return new TransactionalEmailError('transaction-conflict')
    }
    current = detail.cause
  }
  return new TransactionalEmailError('storage-unavailable')
}

export async function runOwnedTransaction<Result>(
  req: PayloadRequest,
  work: (req: PayloadRequest, transactionID: number | string) => Promise<Result>,
): Promise<Result> {
  if (typeof req.transactionID !== 'undefined') throw new TransactionalEmailError('storage-unavailable')
  for (let attempt = 1; attempt <= maximumTransactionAttempts; attempt++) {
    let transactionID: number | string | null = null
    try {
      transactionID = await req.payload.db.beginTransaction({
        accessMode: 'read write',
        isolationLevel: 'serializable',
      })
      if (transactionID === null) throw new TransactionalEmailError('storage-unavailable')
      const transactionReq = await createLocalReq({ user: req.user ?? undefined, req: { transactionID } }, req.payload)
      const result = await work(transactionReq, transactionID)
      if (!isActiveTransaction(transactionReq, transactionID)) throw new TransactionalEmailError('storage-unavailable')
      await req.payload.db.commitTransaction(transactionID)
      return result
    } catch (error) {
      if (transactionID !== null) {
        try {
          await req.payload.db.rollbackTransaction(transactionID)
        } catch {
          throw new TransactionalEmailError('storage-unavailable')
        }
      }
      const failure = transactionError(error)
      if (failure.code === 'transaction-conflict' && attempt < maximumTransactionAttempts) continue
      throw failure
    }
  }
  throw new TransactionalEmailError('transaction-conflict')
}
