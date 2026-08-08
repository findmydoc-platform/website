import type { CollectionBeforeOperationHook } from 'payload'
import { APIError } from 'payload'

export const preventReviewVersionRestore: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation === 'restoreVersion') {
    throw new APIError('Review versions are immutable audit records and cannot be restored.', 403)
  }

  return args
}
