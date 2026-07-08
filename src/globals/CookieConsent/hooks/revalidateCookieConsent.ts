import type { GlobalAfterChangeHook } from 'payload'

import { executeGlobalChangeRevalidation } from '@/hooks/cacheRevalidationAdapters'

export const revalidateCookieConsent: GlobalAfterChangeHook = async ({ doc, req: { context, payload } }) => {
  if (!context.disableRevalidate) {
    executeGlobalChangeRevalidation({
      global: 'cookieConsent',
      logger: payload.logger,
    })
  }

  return doc
}
