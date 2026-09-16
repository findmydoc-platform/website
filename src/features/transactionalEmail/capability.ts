import type { CollectionBeforeOperationHook, PayloadRequest } from 'payload'
import { TransactionalEmailError } from './errors'
import { isActiveTransaction } from './transactions'

export type WorkerAuthority = { kind: 'claim' | 'worker'; now: () => number; token: string }
const capabilities = new WeakMap<object, { transactionID: number | string; worker?: WorkerAuthority }>()

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
