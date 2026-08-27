import type { CollectionConfig } from 'payload'

import { hiddenSystemTextField, immutableInquiryFields } from './inquiryCommunication/common'
import { validateInquiryReadPosition } from './inquiryCommunication/invariants'

export const InquiryReadPositions: CollectionConfig = {
  slug: 'inquiryReadPositions',
  labels: { singular: 'Inquiry Read Position', plural: 'Inquiry Read Positions' },
  admin: {
    hidden: true,
    group: 'Platform Management',
    useAsTitle: 'readerKey',
    defaultColumns: ['inquiry', 'readerKind', 'updatedAt'],
    description: 'Personal unread positions for inquiry participants',
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
    beforeValidate: [validateInquiryReadPosition],
    beforeChange: [
      immutableInquiryFields(['inquiry', 'clinic', 'readerKind', 'readerPatient', 'readerClinicStaff', 'readerKey']),
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
      name: 'readerKind',
      type: 'select',
      required: true,
      options: [
        { label: 'Patient', value: 'patient' },
        { label: 'Clinic', value: 'clinic' },
      ],
    },
    { name: 'readerPatient', type: 'relationship', relationTo: 'patients', index: true },
    { name: 'readerClinicStaff', type: 'relationship', relationTo: 'clinicStaff', index: true },
    { name: 'lastReadSequence', type: 'number', required: true, defaultValue: 0, min: 0 },
    { name: 'lastReadActivityId', type: 'text' },
    { name: 'forcedUnread', type: 'checkbox', required: true, defaultValue: false },
    { name: 'forcedUnreadEpoch', type: 'number', required: true, defaultValue: 0, min: 0 },
    hiddenSystemTextField('readerKey', { index: true, required: false }),
  ],
  indexes: [{ fields: ['inquiry', 'readerKey'], unique: true }],
  timestamps: true,
}
