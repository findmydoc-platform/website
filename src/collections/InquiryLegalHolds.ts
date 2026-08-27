import type { CollectionConfig } from 'payload'

import { hiddenSystemTextField, immutableInquiryFields } from './inquiryCommunication/common'
import { requireInquiryRetentionCommand } from './inquiryRetention/common'

export const InquiryLegalHolds: CollectionConfig = {
  slug: 'inquiryLegalHolds',
  labels: { singular: 'Inquiry Legal Hold', plural: 'Inquiry Legal Holds' },
  admin: { hidden: true, description: 'Private case-specific legal holds for inquiry records' },
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
      requireInquiryRetentionCommand,
      immutableInquiryFields([
        'targetType',
        'targetId',
        'targetInquiry',
        'targetModerationCase',
        'reasonCategory',
        'responsibleFunction',
        'placedBy',
        'placedAt',
      ]),
    ],
  },
  fields: [
    {
      name: 'targetType',
      type: 'select',
      required: true,
      options: [
        { label: 'Inquiry package', value: 'inquiry' },
        { label: 'Moderation case', value: 'moderation-case' },
      ],
      index: true,
    },
    hiddenSystemTextField('targetId', { index: true }),
    { name: 'activeKey', type: 'text', admin: { hidden: true }, index: true, unique: true },
    { name: 'targetInquiry', type: 'relationship', relationTo: 'patientClinicInquiries', index: true },
    { name: 'targetModerationCase', type: 'relationship', relationTo: 'inquiryModerationCases', index: true },
    {
      name: 'reasonCategory',
      type: 'select',
      required: true,
      options: [
        { label: 'Legal request', value: 'legal-request' },
        { label: 'Regulatory review', value: 'regulatory-review' },
        { label: 'Litigation', value: 'litigation' },
        { label: 'Other authorized hold', value: 'other-authorized' },
      ],
    },
    {
      name: 'responsibleFunction',
      type: 'select',
      required: true,
      options: [
        { label: 'Legal', value: 'legal' },
        { label: 'Data protection', value: 'data-protection' },
      ],
    },
    { name: 'reviewAt', type: 'date', required: true, index: true },
    { name: 'placedBy', type: 'relationship', relationTo: 'platformStaff', required: true },
    { name: 'placedAt', type: 'date', required: true },
    { name: 'releasedBy', type: 'relationship', relationTo: 'platformStaff' },
    { name: 'releasedAt', type: 'date', index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Released', value: 'released' },
      ],
      index: true,
    },
  ],
  indexes: [{ fields: ['targetType', 'targetId', 'status'] }],
  timestamps: true,
}
