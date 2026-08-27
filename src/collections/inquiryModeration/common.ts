import type { CollectionBeforeChangeHook } from 'payload'

export const requireInquiryModerationCommand: CollectionBeforeChangeHook = ({ data, req }) => {
  if (req.context?.inquiryModerationCommand !== true) {
    throw new Error('Inquiry moderation records can only change through the domain command service.')
  }
  return data
}
