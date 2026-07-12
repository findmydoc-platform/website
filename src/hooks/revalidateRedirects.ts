import type { CollectionAfterChangeHook } from 'payload'

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
