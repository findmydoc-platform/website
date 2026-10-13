import type { CollectionConfig } from 'payload'
import {
  guardNotificationDelete,
  guardNotificationWrite,
  notificationStorageAccess,
} from './clinicNotifications/common'

export const ClinicNotificationReadReceipts: CollectionConfig = {
  slug: 'clinicNotificationReadReceipts',
  labels: { singular: 'Clinic Notification Read Receipt', plural: 'Clinic Notification Read Receipts' },
  admin: { hidden: true, description: 'First successful personal acknowledgement of a clinic notification' },
  access: notificationStorageAccess,
  endpoints: false,
  graphQL: false,
  hooks: { beforeChange: [guardNotificationWrite], beforeDelete: [guardNotificationDelete] },
  fields: [
    {
      name: 'occurrence',
      type: 'relationship',
      relationTo: 'clinicNotificationOccurrences',
      required: true,
      index: true,
    },
    { name: 'clinicStaff', type: 'relationship', relationTo: 'clinicStaff', required: true, index: true },
    { name: 'readAt', type: 'date', required: true },
  ],
  indexes: [{ fields: ['occurrence', 'clinicStaff'], unique: true }],
  timestamps: true,
}
