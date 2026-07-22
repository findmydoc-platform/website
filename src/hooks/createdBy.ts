import type { CollectionBeforeChangeHook } from 'payload'
import { extractRelationId } from '@/collections/common/mediaPathHelpers'

/**
 * A reusable beforeChange hook that stamps `createdBy` from `req.user` on create operations.
 * Configure via options if your field or user collection differs.
 */
export function beforeChangeCreatedBy(options?: {
  createdByField?: string
  userCollection?: string
  userCollections?: readonly string[]
}): CollectionBeforeChangeHook {
  const {
    createdByField = 'createdBy',
    userCollection,
    userCollections = ['platformStaff', 'clinicStaff'],
  } = options || {}
  return async ({ data, operation, req, originalDoc }) => {
    const draft = { ...(data || {}) }
    enforceCreatedByFromRequest({
      draft,
      operation,
      reqUser: req?.user,
      originalDoc,
      createdByField,
      userCollections: userCollection ? [userCollection] : userCollections,
    })
    return draft
  }
}

export function enforceCreatedByFromRequest({
  draft,
  operation,
  reqUser,
  originalDoc,
  createdByField = 'createdBy',
  userCollection,
  userCollections = ['platformStaff', 'clinicStaff'],
}: {
  draft: Record<string, unknown>
  operation: 'create' | 'update'
  reqUser?: { collection?: unknown; id?: unknown } | null
  originalDoc?: unknown
  createdByField?: string
  userCollection?: string
  userCollections?: readonly string[]
}) {
  const allowedCollections = userCollection ? [userCollection] : userCollections
  if (operation === 'create') {
    delete draft[createdByField]

    if (
      typeof reqUser?.collection === 'string' &&
      allowedCollections.includes(reqUser.collection) &&
      reqUser.id != null
    ) {
      draft[createdByField] =
        allowedCollections.length === 1 ? reqUser.id : { relationTo: reqUser.collection, value: reqUser.id }
    }

    return
  }

  const originalRecord = originalDoc && typeof originalDoc === 'object' ? (originalDoc as Record<string, unknown>) : {}
  const incoming = draft[createdByField]
  const existing = originalRecord[createdByField]
  const incomingId = extractRelationId(incoming as Parameters<typeof extractRelationId>[0])
  const existingId = extractRelationId(existing as Parameters<typeof extractRelationId>[0])

  if (incomingId && existingId && incomingId !== existingId) {
    throw new Error(`${createdByField} cannot be changed once set`)
  }

  if (existing !== undefined) {
    draft[createdByField] = existing
  } else {
    delete draft[createdByField]
  }
}
