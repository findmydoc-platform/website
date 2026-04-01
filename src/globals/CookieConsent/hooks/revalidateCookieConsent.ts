import { revalidateTag } from 'next/cache'
import type { GlobalAfterChangeHook } from 'payload'

export const revalidateCookieConsent: GlobalAfterChangeHook = async () => {
  revalidateTag('global_cookieConsent', { expire: 0 })
}
