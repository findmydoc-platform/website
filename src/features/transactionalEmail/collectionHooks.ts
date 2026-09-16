import type { CollectionAfterReadHook, CollectionBeforeChangeHook } from 'payload'
import { requireStorageCapability } from './capability'
import { validateCommand } from './commands'
import { TransactionalEmailError } from './errors'

export const validateStoredCommand: CollectionAfterReadHook = async ({ doc, req }) => {
  await requireStorageCapability(req)
  if (doc.commandPayload !== null && typeof doc.commandPayload !== 'undefined') validateCommand(doc.commandPayload)
  return doc
}

export const guardOutboxWrite: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  await requireStorageCapability(req)
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

export const guardEventWrite: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  await requireStorageCapability(req)
  if (operation !== 'create') throw new TransactionalEmailError('access-denied')
  return data
}

export const denyStorageDelete = () => {
  throw new TransactionalEmailError('access-denied')
}
