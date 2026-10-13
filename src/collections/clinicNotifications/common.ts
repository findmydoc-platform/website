import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig, PayloadRequest } from 'payload'

export function requireNotificationTransaction(
  req: PayloadRequest,
  transactionID: unknown,
): asserts transactionID is string | number {
  if (
    (typeof transactionID !== 'string' && typeof transactionID !== 'number') ||
    !req.payload.db.sessions ||
    !Object.hasOwn(req.payload.db.sessions, transactionID)
  ) {
    throw new Error('Notification storage requires an active native transaction session.')
  }
}

export const notificationStorageAccess: CollectionConfig['access'] = {
  admin: () => false,
  create: () => false,
  delete: () => false,
  read: () => false,
  update: () => false,
}

export const guardNotificationWrite: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  requireNotificationTransaction(req, await req.transactionID)
  if (req.context?.clinicNotificationCommand !== true || operation !== 'create') {
    throw new Error('Notification occurrences and first personal receipts are immutable domain records.')
  }
  return data
}

export const guardNotificationDelete: CollectionBeforeDeleteHook = async ({ req, collection }) => {
  requireNotificationTransaction(req, await req.transactionID)
  if (
    req.context?.clinicNotificationRetention !== true &&
    !(collection.slug === 'clinicNotificationReadReceipts' && req.context?.clinicNotificationReaderDeletion === true)
  ) {
    throw new Error('Notification deletion belongs to the independent retention command.')
  }
}

export const guardNotificationControl: CollectionBeforeChangeHook = async ({ data, req }) => {
  requireNotificationTransaction(req, await req.transactionID)
  if (req.context?.clinicNotificationCommand !== true) {
    throw new Error('Notification control belongs to its serialized domain command.')
  }
  return data
}
