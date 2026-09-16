import type { CollectionAfterReadHook, CollectionBeforeChangeHook } from 'payload'
import { requireStorageCapability, storageWorkerAuthority } from './capability'
import { validateCommand } from './commands'
import { TransactionalEmailError } from './errors'

export const validateStoredCommand: CollectionAfterReadHook = async ({ doc, req }) => {
  await requireStorageCapability(req)
  if (doc.commandPayload !== null && typeof doc.commandPayload !== 'undefined') validateCommand(doc.commandPayload)
  return doc
}

export const guardOutboxWrite: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  await requireStorageCapability(req)
  const merged = { ...originalDoc, ...data }
  const terminal = ['accepted', 'suppressed', 'failed', 'expired'].includes(merged.state)
  if (!terminal) {
    const command = validateCommand(merged.commandPayload)
    if (
      command.type !== merged.commandType ||
      command.operationReference !== merged.operationReference ||
      !merged.recipientAddress
    ) {
      throw new TransactionalEmailError('invalid-command')
    }
  }
  if (
    merged.state === 'prepared' &&
    ['preparedSubject', 'preparedHtml', 'preparedText', 'preparedAt'].some(
      (key) => typeof merged[key] !== 'string' || !merged[key],
    )
  )
    throw new TransactionalEmailError('access-denied')
  if (operation === 'update') {
    for (const field of [
      'commandType',
      'operationReference',
      'providerIdempotencyKey',
      'createdAt',
      'recipientDigest',
      'runtimeEnvironment',
    ]) {
      if (field in data && data[field] !== originalDoc?.[field]) throw new TransactionalEmailError('access-denied')
    }
    const authority = storageWorkerAuthority(req)
    if (!authority) throw new TransactionalEmailError('access-denied')
    if (authority.kind === 'claim') {
      if (
        !['queued', 'prepared'].includes(originalDoc.state) ||
        (originalDoc.leaseExpiresAt && Date.parse(originalDoc.leaseExpiresAt) > authority.now()) ||
        data.leaseToken !== authority.token
      )
        throw new TransactionalEmailError('access-denied')
      if (
        Object.keys(data).some(
          (key) =>
            !['leaseToken', 'leaseExpiresAt', 'latestEventSequence', 'updatedAt'].includes(key) &&
            JSON.stringify(data[key]) !== JSON.stringify(originalDoc[key]),
        )
      )
        throw new TransactionalEmailError('access-denied')
    } else if (
      originalDoc.leaseToken !== authority.token ||
      !(Date.parse(originalDoc.leaseExpiresAt) > authority.now())
    ) {
      throw new TransactionalEmailError('access-denied')
    }
    const allowed: Record<string, string[]> = {
      queued: ['prepared', 'suppressed', 'failed', 'expired'],
      prepared: ['accepted', 'suppressed', 'failed', 'expired'],
    }
    if (merged.state !== originalDoc.state && !allowed[originalDoc.state]?.includes(merged.state))
      throw new TransactionalEmailError('access-denied')
    if (originalDoc.preparedAt && merged.preparedAt !== originalDoc.preparedAt)
      throw new TransactionalEmailError('access-denied')
    if (
      authority.kind === 'worker' &&
      !terminal &&
      (merged.leaseToken !== originalDoc.leaseToken ||
        merged.leaseExpiresAt !== originalDoc.leaseExpiresAt ||
        merged.recipientAddress !== originalDoc.recipientAddress)
    )
      throw new TransactionalEmailError('access-denied')
    if (originalDoc.preparedAt && !terminal) {
      for (const field of ['recipientAddress', 'preparedSubject', 'preparedHtml', 'preparedText', 'preparedAt']) {
        if (field in data && data[field] !== originalDoc[field]) throw new TransactionalEmailError('access-denied')
      }
    }
  } else if (merged.state !== 'queued') throw new TransactionalEmailError('access-denied')
  if (
    terminal &&
    ([
      'commandPayload',
      'recipientAddress',
      'preparedSubject',
      'preparedHtml',
      'preparedText',
      'leaseToken',
      'leaseExpiresAt',
    ].some((key) => merged[key] != null) ||
      !merged.scrubbedAt ||
      !merged.terminalAt)
  ) {
    throw new TransactionalEmailError('access-denied')
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
