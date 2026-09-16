import type { CollectionBeforeOperationHook, PayloadRequest } from 'payload'
import { TransactionalEmailError } from './errors'
import { isActiveTransaction } from './transactions'

export type WorkerAuthority = { kind: 'claim' | 'worker' | 'sweep' | 'provider'; now: () => number; token: string }
const capabilities = new WeakMap<
  object,
  {
    transactionID: number | string
    worker?: WorkerAuthority
    eventAppends?: Set<string>
    retentionDeletes?: Set<string>
  }
>()

export function openStorageCapability(transactionID: number | string, worker?: WorkerAuthority) {
  const identity = Object.freeze({})
  capabilities.set(identity, { transactionID, worker })
  return {
    context: { transactionalEmail: identity },
    close: () => capabilities.delete(identity),
  }
}

export async function requireStorageCapability(req: PayloadRequest): Promise<void> {
  const identity: unknown = req.context?.transactionalEmail
  const transactionID = await req.transactionID
  if (
    !identity ||
    typeof identity !== 'object' ||
    typeof req.transactionID === 'undefined' ||
    capabilities.get(identity)?.transactionID !== transactionID ||
    !isActiveTransaction(req, transactionID)
  )
    throw new TransactionalEmailError('access-denied')
}

export const guardStorageOperation: CollectionBeforeOperationHook = async ({ req }) => {
  await requireStorageCapability(req)
}

export function storageWorkerAuthority(req: PayloadRequest) {
  const identity: unknown = req.context?.transactionalEmail
  return identity && typeof identity === 'object' ? capabilities.get(identity)?.worker : undefined
}

// Issued only after the worker or provider storage seam completes its guarded outbox update.
export function authorizeEventAppends(req: PayloadRequest, outbox: number, sequences: number[]) {
  const state = capabilities.get(req.context.transactionalEmail as object)
  if (!state?.worker) throw new TransactionalEmailError('access-denied')
  state.eventAppends = new Set(sequences.map((sequence) => `${outbox}:${sequence}`))
}

export function consumeEventAppend(req: PayloadRequest, outbox: number, sequence: number) {
  const state = capabilities.get(req.context.transactionalEmail as object)
  if (!state?.worker || !state.eventAppends?.delete(`${outbox}:${sequence}`))
    throw new TransactionalEmailError('access-denied')
}

// The retention transaction grants each deletion only after checking the persisted expiry.
export function authorizeRetentionDeletes(req: PayloadRequest, outbox: number, eventIds: number[]) {
  const state = capabilities.get(req.context.transactionalEmail as object)
  if (state?.worker?.kind !== 'sweep') throw new TransactionalEmailError('access-denied')
  state.retentionDeletes = new Set([
    `transactionalEmailOutbox:${outbox}`,
    ...eventIds.map((id) => `transactionalEmailEvents:${id}`),
  ])
}

export function consumeRetentionDelete(req: PayloadRequest, collection: string, id: number | string) {
  const state = capabilities.get(req.context.transactionalEmail as object)
  if (state?.worker?.kind !== 'sweep' || !state.retentionDeletes?.delete(`${collection}:${id}`))
    throw new TransactionalEmailError('access-denied')
}
