import type { CollectionConfig } from 'payload'
import {
  guardSuppressionOperation,
  guardSuppressionWrite,
  guardSuppressionRead,
} from '@/features/transactionalEmail/suppression'

export const TransactionalEmailSuppressions: CollectionConfig = {
  slug: 'transactionalEmailSuppressions',
  admin: { hidden: true, description: 'Private recipient suppression from verified delivery feedback' },
  access: { admin: () => false, create: () => false, read: () => false, update: () => false, delete: () => false },
  endpoints: false,
  graphQL: false,
  lockDocuments: false,
  hooks: {
    beforeOperation: [guardSuppressionOperation],
    beforeChange: [guardSuppressionWrite],
    afterRead: [guardSuppressionRead],
  },
  indexes: [{ fields: ['runtimeEnvironment', 'recipientDigest'], unique: true }],
  fields: [
    { name: 'runtimeEnvironment', type: 'select', options: ['preview', 'production'], required: true },
    { name: 'recipientDigest', type: 'text', required: true },
    { name: 'reason', type: 'select', options: ['hard-bounce', 'spam-complaint'], required: true },
    { name: 'firstObservedAt', type: 'date', required: true },
    { name: 'lastObservedAt', type: 'date', required: true },
    { name: 'source', type: 'select', options: ['lettermint'], required: true },
  ],
  timestamps: true,
}
