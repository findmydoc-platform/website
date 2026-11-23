import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { executeRedirectChangeRevalidation } from '@/hooks/cacheRevalidationAdapters'

export const revalidateRedirects: CollectionAfterChangeHook = ({ doc, req: { context, payload } }) => {
  if (context.disableRevalidate) {
    return doc
  }

  executeRedirectChangeRevalidation({
    doc,
    logger: payload.logger,
  })

  return doc
}

export const revalidateDeletedRedirect: CollectionAfterDeleteHook = ({ doc, req: { context, payload } }) => {
  if (!context.disableRevalidate) {
    executeRedirectChangeRevalidation({ doc, logger: payload.logger, operation: 'delete' })
  }
  return doc
}
