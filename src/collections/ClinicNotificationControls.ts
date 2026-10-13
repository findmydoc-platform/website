import type { CollectionConfig } from 'payload'
import { guardNotificationControl, notificationStorageAccess } from './clinicNotifications/common'

export const ClinicNotificationControls: CollectionConfig = {
  slug: 'clinicNotificationControls',
  labels: { singular: 'Clinic Notification Control', plural: 'Clinic Notification Controls' },
  admin: { hidden: true, description: 'One persisted activation boundary for the complete environment catalog' },
  access: notificationStorageAccess,
  endpoints: false,
  graphQL: false,
  hooks: {
    beforeChange: [guardNotificationControl],
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
  ],
  timestamps: true,
}
