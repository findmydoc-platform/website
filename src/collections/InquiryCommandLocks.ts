import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from 'payload'

const requireInquiryCommandLockContext: CollectionBeforeChangeHook = ({ data, req }) => {
  if (req.context?.inquiryCommandLock !== true || typeof req.transactionID === 'undefined') {
    throw new Error('Inquiry command locks require an active domain transaction.')
  }
  return data
}

const requireInquiryCommandLockDeleteContext: CollectionBeforeDeleteHook = ({ req }) => {
  if (req.context?.inquiryCommandLock !== true || typeof req.transactionID === 'undefined') {
    throw new Error('Inquiry command locks require an active domain transaction.')
  }
}

export const InquiryCommandLocks: CollectionConfig = {
  slug: 'inquiryCommandLocks',
  labels: { plural: 'Inquiry Command Locks', singular: 'Inquiry Command Lock' },
  admin: { hidden: true, description: 'Ephemeral transaction locks for private inquiry commands' },
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
    beforeChange: [requireInquiryCommandLockContext],
    beforeDelete: [requireInquiryCommandLockDeleteContext],
  },
  fields: [{ name: 'key', type: 'text', required: true, unique: true, index: true }],
  timestamps: false,
}
