import type { CollectionConfig } from 'payload'
import { notificationStorageAccess, requireNotificationTransaction } from './clinicNotifications/common'

/** Content-free decision facts remain immutable even when a source workflow changes. */
export const ReviewDecisionTransitions: CollectionConfig = {
  slug: 'reviewDecisionTransitions',
  admin: { hidden: true, description: 'Immutable review decision facts without review or moderation content' },
  access: notificationStorageAccess,
  endpoints: false,
  graphQL: false,
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        requireNotificationTransaction(req, await req.transactionID)
        if (req.context.reviewDecisionTransitionWrite !== true || operation !== 'create')
          throw new Error('Review decision facts belong to the source transaction.')
        return data
      },
    ],
    beforeDelete: [
      () => {
        throw new Error('Review decision facts are immutable source evidence.')
      },
    ],
  },
  fields: [
    { name: 'transitionId', type: 'text', required: true, unique: true },
    { name: 'reviewId', type: 'text', required: true, index: true },
    { name: 'clinicScopeId', type: 'text', required: true, index: true },
    { name: 'workflowKind', type: 'select', options: ['response', 'appeal'], required: true },
    { name: 'workflowId', type: 'text', required: true, index: true },
    {
      name: 'eventType',
      type: 'select',
      options: ['clinic_response_decided', 'review_appeal_decided'],
      required: true,
    },
    { name: 'outcome', type: 'select', options: ['approved', 'rejected', 'blocked', 'upheld'], required: true },
    { name: 'occurredAt', type: 'date', required: true },
  ],
  timestamps: true,
}
