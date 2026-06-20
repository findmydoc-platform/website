import type { GlobalAfterChangeHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache.js'

export const revalidateLandingPages: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info('Revalidating landing pages')

    try {
      revalidateTag('global_landingPages', { expire: 0 })
      revalidateTag('pages-sitemap', { expire: 0 })
      revalidatePath('/')
      revalidatePath('/about')
      revalidatePath('/partners/clinics')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      payload.logger.warn(`Unable to revalidate landing pages: ${message}`)
    }
  }

  return doc
}
