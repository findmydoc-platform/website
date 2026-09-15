import type { CollectionAfterReadHook, CollectionBeforeChangeHook } from 'payload'
import { requireStorageCapability } from './capability'
import { validateCommand } from './commands'
import { TransactionalEmailError } from './errors'

export const validateStoredCommand: CollectionAfterReadHook = ({ doc, req }) => {
  requireStorageCapability(req)
  if (doc.commandPayload !== null && typeof doc.commandPayload !== 'undefined') validateCommand(doc.commandPayload)
  return doc
}

export const guardOutboxWrite: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  requireStorageCapability(req)
  const command = validateCommand(data.commandPayload ?? originalDoc?.commandPayload)
  if (
    command.type !== (data.commandType ?? originalDoc?.commandType) ||
    command.operationReference !== (data.operationReference ?? originalDoc?.operationReference)
  ) {
    throw new TransactionalEmailError('invalid-command')
  }
  if (operation === 'update') {
    for (const field of ['commandType', 'operationReference', 'providerIdempotencyKey', 'createdAt']) {
      if (field in data && data[field] !== originalDoc?.[field]) throw new TransactionalEmailError('access-denied')
    }
  }
  return data
}

export const guardEventWrite: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  requireStorageCapability(req)
  if (operation !== 'create') throw new TransactionalEmailError('access-denied')
  return data
}

export const denyStorageDelete = () => {
  throw new TransactionalEmailError('access-denied')
}
