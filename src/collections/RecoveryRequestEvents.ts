import type { CollectionConfig } from 'payload'
import { authActionEnvironments } from '@/auth/actions/contracts'
import {
  guardRecoveryEventOperation,
  guardRecoveryEventWrite,
  guardRecoveryEventDelete,
  readRecoveryEvent,
} from '@/auth/actions/lifecycle'

export const RecoveryRequestEvents: CollectionConfig = {
  slug: 'recoveryRequestEvents',
  admin: {
    hidden: true,
    description: 'Short-lived private abuse counters for password recovery. No recipient or IP content.',
  },
  access: { admin: () => false, create: () => false, read: () => false, update: () => false, delete: () => false },
  graphQL: false,
  lockDocuments: false,
  trash: false,
  timestamps: false,
  hooks: {
    beforeOperation: [guardRecoveryEventOperation],
    beforeChange: [guardRecoveryEventWrite],
    beforeDelete: [guardRecoveryEventDelete],
    afterRead: [readRecoveryEvent],
  },
  indexes: [{ fields: ['environment', 'dimension', 'keyVersion', 'digest', 'observedAt'] }],
  fields: [
    { name: 'environment', type: 'select', required: true, options: [...authActionEnvironments] },
    { name: 'dimension', type: 'select', required: true, options: ['target', 'ip'] },
    { name: 'keyVersion', type: 'text', required: true },
    { name: 'digest', type: 'text', required: true },
    { name: 'observedAt', type: 'date', required: true, index: true },
  ],
}
