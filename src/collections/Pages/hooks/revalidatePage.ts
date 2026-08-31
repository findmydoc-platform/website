import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import {
  executeCollectionChangeRevalidation,
  executeCollectionDeleteRevalidation,
} from '@/hooks/cacheRevalidationAdapters'
import { isPageDraftSaveIntent } from './pageDraftIntent'

export const revalidatePage: CollectionAfterChangeHook = ({ doc, previousDoc, req: { payload, context } }) => {
  if (!context.disableRevalidate && !isPageDraftSaveIntent(context)) {
    executeCollectionChangeRevalidation({
      collection: 'pages',
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
      collection: 'pages',
      doc,
      logger: payload.logger,
    })
  }

  return doc
}
