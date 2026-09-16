import type { CollectionConfig } from 'payload'
import { guardStorageOperation } from '@/features/transactionalEmail/capability'
import { denyStorageDelete, guardEventWrite } from '@/features/transactionalEmail/collectionHooks'

export const TransactionalEmailEvents: CollectionConfig = {
  slug: 'transactionalEmailEvents',
  admin: { hidden: true, description: 'Private immutable transactional email event history' },
  access: { admin: () => false, create: () => false, read: () => false, update: () => false, delete: () => false },
  endpoints: false,
  graphQL: false,
  lockDocuments: false,
  hooks: {
    beforeOperation: [guardStorageOperation],
    beforeChange: [guardEventWrite],
    beforeDelete: [denyStorageDelete],
  },
  indexes: [{ fields: ['outbox', 'sequence'], unique: true }],
  fields: [
    { name: 'outbox', type: 'relationship', relationTo: 'transactionalEmailOutbox', required: true, index: true },
    { name: 'sequence', type: 'number', required: true, min: 1 },
    {
      name: 'type',
      type: 'select',
      options: [
        'command.accepted',
        'lease.acquired',
        'preparation.completed',
        'preparation.failed',
        'delivery.attempt-started',
        'delivery.accepted',
        'delivery.suppressed',
        'delivery.failed',
        'delivery.expired',
        'payload.scrubbed',
      ],
      required: true,
    },
    { name: 'source', type: 'select', options: ['command', 'worker', 'provider'], required: true },
    { name: 'attemptNumber', type: 'number', min: 1 },
    {
      name: 'outcomeCode',
      type: 'select',
      options: [
        'fake-accepted',
        'recipient-changed',
        'ineligible',
        'preparation-failed',
        'permanent-failure',
        'expired',
      ],
    },
    { name: 'providerEventId', type: 'text', unique: true },
  ],
  timestamps: true,
}
