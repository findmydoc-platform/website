import type { GlobalAfterChangeHook } from 'payload'

import { executeGlobalChangeRevalidation } from '@/hooks/cacheRevalidationAdapters'

export const revalidateFooter: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    executeGlobalChangeRevalidation({
      global: 'footer',
      logger: payload.logger,
    })
  }

  return doc
}
