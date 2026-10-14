import type { CollectionConfig } from 'payload'
import { notificationStorageAccess, requireNotificationTransaction } from './clinicNotifications/common'

/** Source facts survive native review/version deletion without retaining review content. */
export const ReviewPublicationTransitions: CollectionConfig = {
  slug: 'reviewPublicationTransitions',
  admin: { hidden: true, description: 'Immutable review publication facts without patient or review content' },
  access: notificationStorageAccess,
  endpoints: false,
  graphQL: false,
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        requireNotificationTransaction(req, await req.transactionID)
        if (req.context.reviewPublicationTransitionWrite !== true || operation !== 'create')
          throw new Error('Review publication facts belong to the source transaction.')
        return data
      },
    ],
    beforeDelete: [
      () => {
        throw new Error('Review publication facts are immutable source evidence.')
      },
    ],
  },
  fields: [
    { name: 'transitionId', type: 'text', required: true, unique: true },
    { name: 'reviewId', type: 'text', required: true, index: true },
    { name: 'clinicScopeId', type: 'text', required: true, index: true },
    {
      name: 'eventType',
      type: 'select',
      options: ['review_published', 'review_withdrawn', 'review_removed'],
      required: true,
    },
    { name: 'occurredAt', type: 'date', required: true },
  ],
  timestamps: true,
}
