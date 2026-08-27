import type { CollectionConfig } from 'payload'

import { immutableInquiryFields } from './inquiryCommunication/common'
import { requireInquiryRetentionCommand } from './inquiryRetention/common'

export const InquiryRetentionPolicies: CollectionConfig = {
  slug: 'inquiryRetentionPolicies',
  labels: { singular: 'Inquiry Retention Policy', plural: 'Inquiry Retention Policies' },
  admin: { hidden: true, description: 'Versioned retention rules for inquiry communication and moderation' },
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
        'policyKey',
        'version',
        'effectiveFrom',
        'communicationReviewMonths',
        'moderationReviewMonths',
      ]),
    ],
  },
  fields: [
    { name: 'policyKey', type: 'text', required: true, index: true },
    { name: 'version', type: 'text', required: true, index: true },
    { name: 'effectiveFrom', type: 'date', required: true, index: true },
    { name: 'communicationReviewMonths', type: 'number', required: true, min: 1 },
    { name: 'moderationReviewMonths', type: 'number', required: true, min: 1 },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Retired', value: 'retired' },
      ],
      index: true,
    },
  ],
  indexes: [
    { fields: ['policyKey', 'version'], unique: true },
    { fields: ['policyKey', 'effectiveFrom'], unique: true },
  ],
  timestamps: true,
}
