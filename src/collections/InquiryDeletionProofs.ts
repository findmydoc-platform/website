import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { hiddenSystemTextField, immutableInquiryFields } from './inquiryCommunication/common'
import { requireInquiryRetentionCommand } from './inquiryRetention/common'

const validateDeletionProofTransition: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  if (operation !== 'update') return data
  if (
    req.context?.inquiryRetentionFinalizeDelete !== true ||
    originalDoc?.operation !== 'hard-delete-pending' ||
    data?.operation !== 'hard-deleted' ||
    typeof data?.performedAt !== 'string' ||
    !Number.isInteger(data?.deletedObjectCount) ||
    Number(data.deletedObjectCount) < 0
  ) {
    throw new Error('The deletion proof transition is invalid.')
  }
  return data
}

export const InquiryDeletionProofs: CollectionConfig = {
  slug: 'inquiryDeletionProofs',
  labels: { singular: 'Inquiry Deletion Proof', plural: 'Inquiry Deletion Proofs' },
  admin: {
    hidden: true,
    description: 'Minimal content-free lifecycle record for irreversible inquiry deletion operations',
  },
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
      validateDeletionProofTransition,
      immutableInquiryFields(['inquiryId', 'tombstoneKey', 'reasonCategory', 'performedBy', 'policyVersion']),
    ],
  },
  fields: [
    hiddenSystemTextField('inquiryId', { index: true }),
    hiddenSystemTextField('tombstoneKey', { index: true }),
    {
      name: 'operation',
      type: 'select',
      required: true,
      options: [
        { label: 'Anonymized', value: 'anonymized' },
        { label: 'Hard delete pending', value: 'hard-delete-pending' },
        { label: 'Hard deleted', value: 'hard-deleted' },
      ],
      index: true,
    },
    {
      name: 'reasonCategory',
      type: 'select',
      required: true,
      options: [
        { label: 'Authorized erasure', value: 'authorized-erasure' },
        { label: 'Retention review', value: 'retention-review' },
      ],
    },
    { name: 'performedBy', type: 'relationship', relationTo: 'platformStaff', required: true },
    { name: 'performedAt', type: 'date', required: true, index: true },
    { name: 'policyVersion', type: 'text', required: true },
    { name: 'deletedObjectCount', type: 'number', required: true, min: 0 },
  ],
  indexes: [{ fields: ['tombstoneKey'], unique: true }],
  timestamps: true,
}
