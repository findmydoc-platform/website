import type { GlobalAfterChangeHook } from 'payload'

import { executeGlobalChangeRevalidation } from '@/hooks/cacheRevalidationAdapters'

export const revalidateLandingPages: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    executeGlobalChangeRevalidation({
      global: 'landingPages',
      logger: payload.logger,
    })
  }

  return doc
}
