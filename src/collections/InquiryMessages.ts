import type { CollectionConfig } from 'payload'

import { hiddenSystemTextField, immutableInquiryFields } from './inquiryCommunication/common'
import { validateInquiryMessage } from './inquiryCommunication/invariants'

export const InquiryMessages: CollectionConfig = {
  slug: 'inquiryMessages',
  labels: { singular: 'Inquiry Message', plural: 'Inquiry Messages' },
  admin: {
    hidden: true,
    group: 'Platform Management',
    useAsTitle: 'id',
    defaultColumns: ['inquiry', 'authorKind', 'createdAt'],
    description: 'Immutable external patient-clinic messages',
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
    beforeValidate: [validateInquiryMessage],
    beforeChange: [
      immutableInquiryFields([
        'conversation',
        'inquiry',
        'clinic',
        'patient',
        'authorKind',
        'authorPatient',
        'authorClinicStaff',
        'text',
        'attachment',
        'actorKey',
        'idempotencyKey',
        'requestHash',
        'sequence',
        'externalSequence',
        'clinicNotificationSequence',
      ]),
    ],
  },
  fields: [
    {
      name: 'conversation',
      type: 'relationship',
      relationTo: 'inquiryConversations',
      required: true,
      index: true,
    },
    {
      name: 'inquiry',
      type: 'relationship',
      relationTo: 'patientClinicInquiries',
      required: true,
      index: true,
    },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics', required: true, index: true },
    { name: 'patient', type: 'relationship', relationTo: 'patients', required: true, index: true },
    {
      name: 'authorKind',
      type: 'select',
      required: true,
      options: [
        { label: 'Patient', value: 'patient' },
        { label: 'Clinic', value: 'clinic' },
      ],
      index: true,
    },
    { name: 'authorPatient', type: 'relationship', relationTo: 'patients', index: true },
    { name: 'authorClinicStaff', type: 'relationship', relationTo: 'clinicStaff', index: true },
    { name: 'text', type: 'textarea', maxLength: 3_000 },
    { name: 'attachment', type: 'relationship', relationTo: 'inquiryAttachments', unique: true },
    { name: 'sequence', type: 'number', required: true, min: 1, index: true },
    { name: 'externalSequence', type: 'number', required: true, min: 1, index: true },
    { name: 'clinicNotificationSequence', type: 'number', required: true, min: 0, index: true },
    hiddenSystemTextField('actorKey', { index: true }),
    hiddenSystemTextField('idempotencyKey', { index: true }),
    hiddenSystemTextField('requestHash'),
  ],
  indexes: [{ fields: ['inquiry', 'actorKey', 'idempotencyKey'], unique: true }],
  timestamps: true,
  trash: true,
}
