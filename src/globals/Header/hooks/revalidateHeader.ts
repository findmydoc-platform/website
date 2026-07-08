import type { GlobalAfterChangeHook } from 'payload'

import { executeGlobalChangeRevalidation } from '@/hooks/cacheRevalidationAdapters'

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    executeGlobalChangeRevalidation({
      global: 'header',
      logger: payload.logger,
    })
  }

  return doc
}
