import type { CollectionAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'

export const revalidateRedirects: CollectionAfterChangeHook = ({ doc, req: { context, payload } }) => {
  if (context.disableRevalidate) {
    return doc
  }

  payload.logger.info(`Revalidating redirects`)

  revalidateTag('redirects', { expire: 0 })

  return doc
}
