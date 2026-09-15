import type { CollectionConfig } from 'payload'
import { commandTypes } from '@/features/transactionalEmail/commands'
import { guardStorageOperation } from '@/features/transactionalEmail/capability'
import {
  denyStorageDelete,
  guardOutboxWrite,
  validateStoredCommand,
} from '@/features/transactionalEmail/collectionHooks'

export const TransactionalEmailOutbox: CollectionConfig = {
  slug: 'transactionalEmailOutbox',
  admin: { hidden: true, description: 'Private accepted transactional email operations' },
  access: { admin: () => false, create: () => false, read: () => false, update: () => false, delete: () => false },
  endpoints: false,
  graphQL: false,
  lockDocuments: false,
  hooks: {
    beforeOperation: [guardStorageOperation],
    beforeChange: [guardOutboxWrite],
    beforeDelete: [denyStorageDelete],
    afterRead: [validateStoredCommand],
  },
  indexes: [{ fields: ['commandType', 'operationReference'], unique: true }],
  fields: [
    { name: 'commandType', type: 'select', options: [...commandTypes], required: true, index: true },
    { name: 'operationReference', type: 'text', required: true },
    { name: 'commandPayload', type: 'json', required: true },
    {
      name: 'runtimeEnvironment',
      type: 'select',
      options: ['local', 'test', 'ci', 'preview', 'production'],
      required: true,
    },
    {
      name: 'state',
      type: 'select',
      options: [
        'queued',
        'prepared',
        'accepted',
        'delivered',
        'suppressed',
        'bounced',
        'complained',
        'failed',
        'expired',
      ],
      required: true,
      index: true,
    },
    { name: 'providerIdempotencyKey', type: 'text', required: true, unique: true },
    { name: 'recipientAddress', type: 'email', required: true },
    { name: 'recipientDigest', type: 'text', required: true },
    { name: 'latestEventSequence', type: 'number', required: true, min: 1 },
  ],
  timestamps: true,
}
