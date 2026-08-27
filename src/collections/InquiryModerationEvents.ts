import type { CollectionConfig } from 'payload'

import { hiddenSystemTextField, immutableInquiryFields } from './inquiryCommunication/common'
import { requireInquiryModerationCommand } from './inquiryModeration/common'
import { validateInquiryModerationEvent } from './inquiryModeration/invariants'

export const InquiryModerationEvents: CollectionConfig = {
  slug: 'inquiryModerationEvents',
  labels: { plural: 'Inquiry Moderation Events', singular: 'Inquiry Moderation Event' },
  admin: { hidden: true, description: 'Content-free audit events for inquiry moderation' },
  access: {
    admin: () => false,
    create: () => false,
    delete: () => false,
    read: () => false,
    update: () => false,
  },
  endpoints: false,
  graphQL: false,
  hooks: {
    beforeChange: [
      requireInquiryModerationCommand,
      immutableInquiryFields([
        'moderationCase',
        'inquiry',
        'clinic',
        'patient',
        'conversation',
        'actorKind',
        'actorId',
        'eventType',
        'reason',
        'fromValue',
        'toValue',
        'targetType',
        'targetId',
        'sequence',
      ]),
    ],
    beforeValidate: [validateInquiryModerationEvent],
  },
  fields: [
    { name: 'moderationCase', type: 'relationship', relationTo: 'inquiryModerationCases', required: true, index: true },
    { name: 'inquiry', type: 'relationship', relationTo: 'patientClinicInquiries', required: true, index: true },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics', required: true, index: true },
    { name: 'patient', type: 'relationship', relationTo: 'patients', index: true },
    { name: 'conversation', type: 'relationship', relationTo: 'inquiryConversations', required: true, index: true },
    {
      name: 'actorKind',
      type: 'select',
      required: true,
      options: [
        { label: 'Patient', value: 'patient' },
        { label: 'Clinic staff', value: 'clinic' },
        { label: 'Platform staff', value: 'platform' },
        { label: 'System', value: 'system' },
      ],
    },
    hiddenSystemTextField('actorId', { index: true }),
    {
      name: 'eventType',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Report received', value: 'report-received' },
        { label: 'Case accessed', value: 'case-accessed' },
        { label: 'Access expanded', value: 'access-expanded' },
        { label: 'Decision recorded', value: 'decision-recorded' },
        { label: 'Appeal submitted', value: 'appeal-submitted' },
        { label: 'Appeal decided', value: 'appeal-decided' },
        { label: 'Measure ended', value: 'measure-ended' },
      ],
    },
    { name: 'reason', type: 'textarea', maxLength: 1_000 },
    { name: 'fromValue', type: 'text' },
    { name: 'toValue', type: 'text' },
    { name: 'targetType', type: 'text' },
    { name: 'targetId', type: 'text' },
    { name: 'sequence', type: 'number', required: true, min: 1, index: true },
  ],
  indexes: [{ fields: ['moderationCase', 'sequence'], unique: true }],
  timestamps: true,
}
