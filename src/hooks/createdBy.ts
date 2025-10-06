import type { CollectionBeforeChangeHook } from 'payload'

/**
 * A reusable beforeChange hook that stamps `createdBy` from `req.user` on create operations.
 * Configure via options if your field or user collection differs.
 */
export function beforeChangeCreatedBy(options?: {
  createdByField?: string
  userCollection?: string
}): CollectionBeforeChangeHook<any> {
  const { createdByField = 'createdBy', userCollection = 'basicUsers' } = options || {}
  return async ({ data, operation, req }) => {
    const draft: any = { ...(data || {}) }
    if (operation === 'create' && req?.user && req.user.collection === userCollection) {
      draft[createdByField] = draft[createdByField] ?? req.user.id
    }
    return draft
  }
}
