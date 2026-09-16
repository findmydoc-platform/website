import type { CollectionBeforeDeleteHook, CollectionAfterReadHook, CollectionBeforeChangeHook } from 'payload'
import {
  consumeRetentionDelete,
  consumeWorkerEventAppend,
  requireStorageCapability,
  storageWorkerAuthority,
} from './capability'
import { needsScrubbing, outgoingTerminalStates, transientFields } from './retentionPolicy'
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
  const terminal = outgoingTerminalStates.includes(merged.state)
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
      'deliveryDeadline',
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
    } else if (authority.kind === 'sweep') {
      if (
        !needsScrubbing(originalDoc, authority.now()) ||
        merged.state !== (outgoingTerminalStates.includes(originalDoc.state) ? originalDoc.state : 'expired') ||
        Object.keys(data).some(
          (key) =>
            ![
              ...Object.keys(transientFields),
              'state',
              'terminalAt',
              'scrubbedAt',
              'latestEventSequence',
              'updatedAt',
            ].includes(key) && JSON.stringify(data[key]) !== JSON.stringify(originalDoc[key]),
        )
      )
        throw new TransactionalEmailError('access-denied')
    } else if (
      originalDoc.leaseToken !== authority.token ||
      !(Date.parse(originalDoc.leaseExpiresAt) > authority.now())
    ) {
      throw new TransactionalEmailError('access-denied')
    }
    if (originalDoc.terminalAt && merged.terminalAt !== originalDoc.terminalAt)
      throw new TransactionalEmailError('access-denied')
    if (originalDoc.firstAmbiguousAt && merged.firstAmbiguousAt !== originalDoc.firstAmbiguousAt)
      throw new TransactionalEmailError('access-denied')
    if (
      !Number.isInteger(merged.attemptCount) ||
      merged.attemptCount < originalDoc.attemptCount ||
      merged.attemptCount > 6 ||
      merged.attemptCount > originalDoc.attemptCount + 1
    )
      throw new TransactionalEmailError('access-denied')
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
      !(merged.nextAttemptAt && merged.leaseToken === null && merged.leaseExpiresAt === null) &&
      (merged.leaseToken !== originalDoc.leaseToken || merged.leaseExpiresAt !== originalDoc.leaseExpiresAt)
    )
      throw new TransactionalEmailError('access-denied')
    if (!terminal && merged.recipientAddress !== originalDoc.recipientAddress)
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
      'nextAttemptAt',
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
  if (storageWorkerAuthority(req) || data.source === 'worker') {
    if (data.source !== 'worker') throw new TransactionalEmailError('access-denied')
    consumeWorkerEventAppend(req, data.outbox, data.sequence)
  }
  return data
}

export const guardStorageDelete: CollectionBeforeDeleteHook = async ({ req, collection, id }) => {
  await requireStorageCapability(req)
  consumeRetentionDelete(req, collection.slug, id)
}
