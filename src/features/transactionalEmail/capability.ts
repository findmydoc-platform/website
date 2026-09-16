import type { CollectionBeforeOperationHook, PayloadRequest } from 'payload'
import { TransactionalEmailError } from './errors'
import { isActiveTransaction } from './transactions'

const capabilities = new WeakMap<object, number | string>()

export function openStorageCapability(transactionID: number | string) {
  const identity = Object.freeze({})
  capabilities.set(identity, transactionID)
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
    capabilities.get(identity) !== transactionID ||
    !isActiveTransaction(req, transactionID)
  )
    throw new TransactionalEmailError('access-denied')
}

export const guardStorageOperation: CollectionBeforeOperationHook = async ({ req }) => {
  await requireStorageCapability(req)
}
