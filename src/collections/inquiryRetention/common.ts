import type { CollectionBeforeChangeHook } from 'payload'

export const requireInquiryRetentionCommand: CollectionBeforeChangeHook = ({ data, req }) => {
  if (req.context?.inquiryRetentionCommand !== true) {
    throw new Error('Inquiry retention records can only change through the domain command service.')
  }
  return data
}
