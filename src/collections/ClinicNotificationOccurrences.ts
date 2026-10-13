import type { CollectionConfig } from 'payload'
import { notificationMemberSchema } from '@/features/clinicNotifications/contracts'
import {
  guardNotificationDelete,
  guardNotificationWrite,
  notificationStorageAccess,
} from './clinicNotifications/common'

export const ClinicNotificationOccurrences: CollectionConfig = {
  slug: 'clinicNotificationOccurrences',
  labels: { singular: 'Clinic Notification Occurrence', plural: 'Clinic Notification Occurrences' },
  admin: { hidden: true, description: 'Immutable clinic events with independent ninety-day retention' },
  access: notificationStorageAccess,
  endpoints: false,
  graphQL: false,
  hooks: {
    beforeChange: [
      guardNotificationWrite,
      ({ data }) => {
        notificationMemberSchema.parse({
          notificationId: data.notificationId,
          schemaVersion: data.schemaVersion,
          eventType: data.eventType,
          sourceRecord: { kind: data.sourceRecordKind, id: data.sourceRecordId },
          sourceOccurrence: { kind: data.sourceOccurrenceKind, id: data.sourceOccurrenceId },
          occurredAt: data.occurredAt,
          expiresAt: data.expiresAt,
          readAt: null,
          ...(data.outcome ? { outcome: data.outcome } : {}),
        })
        return data
      },
    ],
    beforeDelete: [guardNotificationDelete],
  },
  fields: [
    { name: 'notificationId', type: 'text', required: true, unique: true, index: true },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics', required: true, index: true },
    { name: 'schemaVersion', type: 'number', required: true, defaultValue: 1 },
    { name: 'eventType', type: 'text', required: true, index: true },
    { name: 'sourceRecordKind', type: 'select', options: ['inquiry', 'review'], required: true },
    { name: 'sourceRecordId', type: 'text', required: true, index: true },
    { name: 'sourceOccurrenceKind', type: 'text', required: true },
    { name: 'sourceOccurrenceId', type: 'text', required: true },
    { name: 'occurredAt', type: 'date', required: true, index: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'outcome', type: 'select', options: ['approved', 'rejected', 'blocked', 'upheld', 'confirmed', 'lifted'] },
    { name: 'rating', type: 'number', min: 1, max: 5 },
  ],
  indexes: [{ fields: ['clinic', 'eventType', 'sourceOccurrenceKind', 'sourceOccurrenceId'], unique: true }],
  timestamps: true,
}
