import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import {
  executeCollectionChangeRevalidation,
  executeCollectionDeleteRevalidation,
} from '@/hooks/cacheRevalidationAdapters'

export const revalidatePost: CollectionAfterChangeHook = ({ doc, previousDoc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    executeCollectionChangeRevalidation({
      collection: 'posts',
      doc,
      previousDoc,
      logger: payload.logger,
    })
  }

  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    executeCollectionDeleteRevalidation({
      collection: 'posts',
      doc,
      logger: payload.logger,
    })
  }

  return doc
}
