import type { CollectionConfig } from 'payload'

import { hiddenSystemTextField, immutableInquiryFields } from './inquiryCommunication/common'
import { validateInquiryInternalNote } from './inquiryCommunication/invariants'

export const InquiryInternalNotes: CollectionConfig = {
  slug: 'inquiryInternalNotes',
  labels: { singular: 'Inquiry Internal Note', plural: 'Inquiry Internal Notes' },
  admin: {
    hidden: true,
    group: 'Platform Management',
    useAsTitle: 'id',
    defaultColumns: ['inquiry', 'authorClinicStaff', 'createdAt'],
    description: 'Immutable clinic-only notes for an inquiry',
  },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
    admin: () => false,
  },
  endpoints: false,
  graphQL: false,
  hooks: {
    beforeValidate: [validateInquiryInternalNote],
    beforeChange: [
      immutableInquiryFields([
        'inquiry',
        'clinic',
        'authorClinicStaff',
        'text',
        'contentState',
        'actorKey',
        'idempotencyKey',
        'requestHash',
        'sequence',
        'clinicNotificationSequence',
      ]),
    ],
  },
  fields: [
    {
      name: 'inquiry',
      type: 'relationship',
      relationTo: 'patientClinicInquiries',
      required: true,
      index: true,
    },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics', required: true, index: true },
    {
      name: 'authorClinicStaff',
      type: 'relationship',
      relationTo: 'clinicStaff',
      index: true,
    },
    { name: 'text', type: 'textarea', maxLength: 3_000 },
    {
      name: 'contentState',
      type: 'select',
      required: true,
      defaultValue: 'available',
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Hard deleted', value: 'hard-deleted' },
      ],
      index: true,
    },
    { name: 'sequence', type: 'number', required: true, min: 1, index: true },
    { name: 'clinicNotificationSequence', type: 'number', required: true, min: 1, index: true },
    hiddenSystemTextField('actorKey', { index: true, required: false }),
    hiddenSystemTextField('idempotencyKey', { index: true }),
    hiddenSystemTextField('requestHash'),
  ],
  indexes: [{ fields: ['inquiry', 'actorKey', 'idempotencyKey'], unique: true }],
  timestamps: true,
  trash: true,
}
