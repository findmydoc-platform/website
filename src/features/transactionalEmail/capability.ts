import type { CollectionBeforeOperationHook, PayloadRequest } from 'payload'
import { TransactionalEmailError } from './errors'

const capabilities = new WeakMap<object, number | string>()

export function openStorageCapability(transactionID: number | string) {
  const identity = Object.freeze({})
  capabilities.set(identity, transactionID)
  return {
    context: { transactionalEmail: identity },
    close: () => capabilities.delete(identity),
  }
}

export function requireStorageCapability(req: PayloadRequest): void {
  const identity: unknown = req.context?.transactionalEmail
  if (
    !identity ||
    typeof identity !== 'object' ||
    typeof req.transactionID === 'undefined' ||
    capabilities.get(identity) !== req.transactionID
  )
    throw new TransactionalEmailError('access-denied')
}

export const guardStorageOperation: CollectionBeforeOperationHook = ({ req }) => {
  requireStorageCapability(req)
}
