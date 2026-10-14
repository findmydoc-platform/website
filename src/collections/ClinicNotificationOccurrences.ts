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
        if (
          typeof data.clinicScopeId !== 'string' ||
          !data.clinicScopeId.trim() ||
          data.clinicScopeId !== data.clinicScopeId.trim() ||
          data.clinicScopeId.length > 200
        )
          throw new Error('Notification occurrences require an immutable canonical clinic scope.')
        const clinicRelation = data.clinic
        const clinicId =
          typeof clinicRelation === 'string' || typeof clinicRelation === 'number'
            ? String(clinicRelation)
            : clinicRelation && typeof clinicRelation === 'object' && 'id' in clinicRelation
              ? String(clinicRelation.id)
              : null
        if (clinicId !== null && data.clinicScopeId !== clinicId)
          throw new Error('Notification clinic scope must preserve its canonical clinic identity.')
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
    {
      name: 'clinicScopeId',
      type: 'text',
      index: true,
      admin: { readOnly: true, description: 'Immutable clinic scope preserved independently of clinic deletion' },
    },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics', index: true },
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
  indexes: [
    { fields: ['clinic', 'eventType', 'sourceOccurrenceKind', 'sourceOccurrenceId'], unique: true },
    { fields: ['clinicScopeId', 'eventType', 'sourceOccurrenceKind', 'sourceOccurrenceId'], unique: true },
  ],
  timestamps: true,
}
