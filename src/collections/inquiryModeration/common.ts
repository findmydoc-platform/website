import type { CollectionBeforeChangeHook } from 'payload'

export const requireInquiryModerationCommand: CollectionBeforeChangeHook = ({ data, req }) => {
  const retentionScrub = req.context?.inquiryRetentionCommand === true && req.context?.inquiryRetentionScrub === true
  if (req.context?.inquiryModerationCommand !== true && !retentionScrub) {
    throw new Error('Inquiry moderation records can only change through the domain command service.')
  }
  return data
}
