import { clinicProfileLocaleFromPath } from '@/i18n/clinicProfilePath'
import { PUBLIC_DISCOVERY_SURFACE_PATHS } from '@/features/publicDiscovery/site'
import { CLINIC_APPLICATION_PATHS } from '@/i18n/clinicApplicationPath'
import { buildPagePath, buildPostPath } from '@/utilities/cachePolicy'
import { isReservedPageSlug, type ContentLocale } from '@/utilities/contentLocalization'
import { isPublicStaticAssetPath } from '@/utilities/routing/publicStaticAssets'
import { sanitizeInternalRedirectPathOrNull } from '@/utilities/routing/sanitizeInternalRedirectPath'

export type CmsRedirectCollection = 'pages' | 'posts'

export type CmsRedirectSource = {
  collection: CmsRedirectCollection
  locale: ContentLocale
  slug: string
}

// These routes take precedence over the CMS Page catch-all.
const DEDICATED_PAGE_PATHS = new Set([
  '/',
  '/about',
  '/auth/callback',
  '/auth/confirm',
  '/auth/en/confirm',
  '/auth/en/password/reset/complete',
  '/auth/invite/complete',
  '/auth/password/complete',
  '/auth/password/reset',
  '/auth/password/reset/complete',
  '/contact',
  '/listing-comparison',
  '/login/patient',
  '/logout',
  '/next/exit-preview',
  '/next/preview',
  '/partners/clinics',
  '/patient/favorites',
  '/patient/inquiries',
  '/posts',
  ...Object.values(CLINIC_APPLICATION_PATHS),
  '/register/patient',
  ...PUBLIC_DISCOVERY_SURFACE_PATHS,
])

const RESERVED_PAGE_NAMESPACE = /^\/(?:admin|api|_next)(?:\/|$)/
const DEDICATED_DYNAMIC_PAGE = /^\/(?:patient\/inquiries\/[^/]+|posts\/[^/]+|posts\/page\/[^/]+)$/

export function buildCmsRedirectPath(
  collection: CmsRedirectCollection,
  locale: ContentLocale,
  slug: string,
): string | null {
  if (collection === 'pages' && isReservedPageSlug(slug, locale)) return null

  try {
    const path = collection === 'pages' ? buildPagePath(slug, locale) : buildPostPath(slug, locale)

    if (
      collection === 'pages' &&
      (DEDICATED_PAGE_PATHS.has(path) ||
        clinicProfileLocaleFromPath(path) ||
        RESERVED_PAGE_NAMESPACE.test(path) ||
        DEDICATED_DYNAMIC_PAGE.test(path) ||
        isPublicStaticAssetPath(path))
    ) {
      return null
    }

    return sanitizeInternalRedirectPathOrNull({ nextPath: path }) === path ? path : null
  } catch {
    return null
  }
}

export function parseCmsRedirectPath(path: string): CmsRedirectSource | null {
  const collection: CmsRedirectCollection = /^(?:\/en)?\/posts\/[^/]+$/.test(path) ? 'posts' : 'pages'
  const locale: ContentLocale = path === '/en' || path.startsWith('/en/') ? 'en' : 'de'
  const unprefixedPath = (locale === 'en' ? path.slice('/en'.length) : path) || '/'
  const prefix = collection === 'posts' ? '/posts/' : '/'
  if (!unprefixedPath.startsWith(prefix)) return null

  const slug = unprefixedPath.slice(prefix.length) || 'home'
  return buildCmsRedirectPath(collection, locale, slug) === path ? { collection, locale, slug } : null
}
