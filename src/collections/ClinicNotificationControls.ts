import type { CollectionConfig } from 'payload'
import {
  finishHostedCaptureOperation,
  guardCaptureActivationBoundary,
  prepareHostedCaptureOperation,
} from '@/features/clinicNotifications/hostedCapture'
import {
  guardNotificationControl,
  notificationStorageAccess,
  requireNotificationTransaction,
} from './clinicNotifications/common'

export const ClinicNotificationControls: CollectionConfig = {
  slug: 'clinicNotificationControls',
  labels: { singular: 'Clinic Notification Control', plural: 'Clinic Notification Controls' },
  admin: {
    hidden: true,
    description: 'Private capture activation, authorization ordering and independent retention scheduling state',
  },
  access: notificationStorageAccess,
  endpoints: false,
  graphQL: false,
  hooks: {
    beforeOperation: [prepareHostedCaptureOperation],
    afterOperation: [finishHostedCaptureOperation],
    beforeChange: [
      guardCaptureActivationBoundary,
      async (args) => {
        if ((args.data.key ?? args.originalDoc?.key) !== 'notification-retention') return guardNotificationControl(args)
        requireNotificationTransaction(args.req, await args.req.transactionID)
        if (args.req.context?.clinicNotificationRetention !== true)
          throw new Error('Retention scheduling belongs to the independent retention command.')
        return args.data
      },
    ],
    beforeDelete: [
      () => {
        throw new Error('Notification activation boundaries cannot be deleted.')
      },
    ],
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'active', type: 'checkbox', required: true, defaultValue: false },
    { name: 'activatedAt', type: 'date' },
    { name: 'nonce', type: 'text', required: true },
    { name: 'retentionStartedAt', type: 'date' },
    { name: 'retentionCompletedAt', type: 'date' },
    { name: 'retentionSlot', type: 'number' },
    { name: 'retentionLeaseToken', type: 'text' },
    { name: 'retentionLeaseExpiresAt', type: 'date' },
    { name: 'retentionResult', type: 'select', options: ['running', 'success', 'incomplete', 'failure'] },
  ],
  timestamps: true,
}
