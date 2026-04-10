import { revalidateTag } from 'next/cache'
import type { GlobalAfterChangeHook } from 'payload'

export const revalidateCookieConsent: GlobalAfterChangeHook = async ({ doc, req: { context, payload } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating cookie consent`)

    revalidateTag('global_cookieConsent', { expire: 0 })
  }

  return doc
}
