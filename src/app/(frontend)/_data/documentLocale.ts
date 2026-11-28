import { cache } from 'react'

import { loadPageRoute } from './loadPageRoute'
import { resolvePost } from './resolvePost'
import { FRONTEND_PATH_HEADER, FRONTEND_PREVIEW_LOCALE_HEADER, UI_COPY_LOCALE_HEADER } from '@/i18n/requestLocale'
import { SAVED_CLINICS_PATHS } from '@/i18n/savedClinicsPath'
import { PUBLIC_DISCOVERY_SURFACE_PATHS } from '@/features/publicDiscovery/site'
import type { ContentLocale } from '@/utilities/contentLocalization'

// Dedicated Next routes take precedence over the CMS Page catch-all.
const DEDICATED_PATHS = new Set([
  '/',
  '/about',
  '/auth/confirm',
  '/auth/en/confirm',
  '/auth/invite/complete',
  '/auth/password/reset',
  '/auth/password/reset/complete',
  '/auth/en/password/reset/complete',
  '/contact',
  '/en/auth/password/reset',
  '/en/listing-comparison',
  '/en/login/patient',
  '/en/register/patient',
  '/listing-comparison',
  '/login/patient',
  '/logout',
  '/partners/clinics',
  ...Object.values(SAVED_CLINICS_PATHS),
  '/patient/inquiries',
  '/posts',
  '/register/clinic',
  '/register/patient',
  ...PUBLIC_DISCOVERY_SURFACE_PATHS,
])

const DEDICATED_PATH_FAMILIES = /^\/(?:admin(?:\/|$)|(?:clinics|patient\/inquiries|posts\/page)\/[^/]+$)/

export const resolveCmsDocumentLocale = cache(async (requestHeaders: Headers): Promise<ContentLocale | undefined> => {
  if (requestHeaders.has(UI_COPY_LOCALE_HEADER)) return undefined
  const pathname = requestHeaders.get(FRONTEND_PATH_HEADER)?.replace(/\/$/, '') || '/'
  if (DEDICATED_PATHS.has(pathname) || DEDICATED_PATH_FAMILIES.test(pathname)) return undefined

  let segments: string[]
  try {
    segments = pathname.slice(1).split('/').map(decodeURIComponent)
  } catch {
    return undefined
  }

  const requestedPreviewLocale = requestHeaders.get(FRONTEND_PREVIEW_LOCALE_HEADER)
  const previewLocale =
    requestedPreviewLocale === 'de' || requestedPreviewLocale === 'en' ? requestedPreviewLocale : undefined
  const postRoute = /^(?:\/en)?\/posts\/[^/]+$/.test(pathname)
  if (postRoute) {
    const slug = segments.at(-1)
    if (!slug) return undefined
    const pathLocale = segments[0] === 'en' ? 'en' : 'de'
    const { route } = await resolvePost(slug, pathLocale, previewLocale ?? pathLocale)
    return route?.locale
  }

  const { route } = await loadPageRoute(segments, previewLocale)
  return route?.locale
})
