import type { CollectionConfig } from 'payload'
import { guardStorageOperation } from '@/features/transactionalEmail/capability'
import { guardStorageDelete, guardEventWrite } from '@/features/transactionalEmail/collectionHooks'

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
    beforeDelete: [guardStorageDelete],
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
        'delivery.retry-scheduled',
        'delivery.ambiguous',
        'delivery.accepted',
        'delivery.delivered',
        'delivery.bounced',
        'delivery.complained',
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
        'retryable-failure',
        'ambiguous',
        'expired',
      ],
    },
    { name: 'providerEventId', type: 'text' },
    { name: 'sourceOccurredAt', type: 'date' },
  ],
  timestamps: true,
}
