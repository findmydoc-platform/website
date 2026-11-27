import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

import { isPlatformUser } from '@/auth/utilities/supabaseAuthPolicy'
import { isPreviewRuntime } from '@/features/runtimePolicy'
import {
  HOLDING_VIEW_REQUEST_HEADER,
  getLegacyTemporaryLandingLocation,
  isTemporaryLandingModeExemptPath,
  isTemporaryLandingIndexablePath,
  isTemporaryLandingPublicExemptPath,
  isTemporaryLandingPublicDiscoveryPath,
  temporaryLandingLocaleFromPath,
  TEMPORARY_LANDING_MODE_REQUEST_HEADER,
  PUBLIC_SITE_MODE_REQUEST_HEADER,
} from '@/features/temporaryLandingMode'
import { resolveHoldingMode, type PublicSiteMode } from '@/features/temporaryLandingMode/resolver'
import {
  SEARCH_INDEXING_REQUEST_HEADER,
  SEARCH_ROBOTS_HEADER,
  SEARCH_ROBOTS_HEADER_VALUE,
} from '@/features/searchIndexing'
import { CMS_TRANSLATION_SOURCE_HEADER } from '@/utilities/routing/cmsRedirectRequest'
import { requestCmsRedirect } from '@/utilities/routing/requestCmsRedirect'
import { isPublicStaticAssetPath } from '@/utilities/routing/publicStaticAssets'
import { parseCmsRedirectPath } from '@/utilities/content/cmsRedirectPaths'
import { logCrawlerRequest } from '@/features/publicDiscovery/crawlerMonitoring'
import { PUBLIC_DISCOVERY_SURFACE_PATHS } from '@/features/publicDiscovery/site'
import {
  FRONTEND_PATH_HEADER,
  FRONTEND_PREVIEW_LOCALE_HEADER,
  patientAuthLocaleFromPath,
  uiCopyLocaleFromPath,
  UI_COPY_LOCALE_HEADER,
} from '@/i18n/requestLocale'

const NON_PAGE_PATHS = new Set(['/next/exit-preview', '/next/preview'])
const PUBLIC_DISCOVERY_PATHS = new Set<string>(PUBLIC_DISCOVERY_SURFACE_PATHS)

const isPathFamily = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

const shouldBypassProxy = (pathname: string): boolean => {
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (isPathFamily(pathname, '/_next')) return true
  if (NON_PAGE_PATHS.has(normalizedPath)) return true
  if (isPublicStaticAssetPath(pathname)) return true
  return false
}

const getHoldingRequestUser = async (request: NextRequest): Promise<User | null> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll() {
          // Holding only reads the server-validated session for its platform staff exception.
        },
      },
    })
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    return error ? null : user
  } catch {
    return null
  }
}

const nextWithRequestHeaders = (request: NextRequest, headersToSet: Record<string, string | null>): NextResponse => {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(FRONTEND_PATH_HEADER, request.nextUrl.pathname)
  requestHeaders.delete(FRONTEND_PREVIEW_LOCALE_HEADER)
  const [previewLocale, ...otherLocales] = request.nextUrl.searchParams.getAll('locale')
  if ((previewLocale === 'de' || previewLocale === 'en') && otherLocales.length === 0) {
    requestHeaders.set(FRONTEND_PREVIEW_LOCALE_HEADER, previewLocale)
  }
  requestHeaders.delete(UI_COPY_LOCALE_HEADER)
  const uiCopyLocale = uiCopyLocaleFromPath(request.nextUrl.pathname, request.nextUrl.searchParams)
  if (uiCopyLocale) requestHeaders.set(UI_COPY_LOCALE_HEADER, uiCopyLocale)
  requestHeaders.delete(PUBLIC_SITE_MODE_REQUEST_HEADER)
  requestHeaders.delete(TEMPORARY_LANDING_MODE_REQUEST_HEADER)
  requestHeaders.delete(HOLDING_VIEW_REQUEST_HEADER)
  requestHeaders.delete(SEARCH_INDEXING_REQUEST_HEADER)
  requestHeaders.delete(CMS_TRANSLATION_SOURCE_HEADER)
  Object.entries(headersToSet).forEach(([key, value]) => {
    if (value === null) {
      requestHeaders.delete(key)
      return
    }

    requestHeaders.set(key, value)
  })
  return NextResponse.next({ request: { headers: requestHeaders } })
}

const withSearchRobotsHeader = (response: NextResponse): NextResponse => {
  response.headers.set(SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE)
  return response
}

const nextWithTemporaryLandingHeaders = (request: NextRequest, publicMode: PublicSiteMode = 'holding'): NextResponse =>
  nextWithRequestHeaders(request, {
    [HOLDING_VIEW_REQUEST_HEADER]: 'standalone',
    [PUBLIC_SITE_MODE_REQUEST_HEADER]: publicMode,
    [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: publicMode === 'holding' ? '1' : null,
    [SEARCH_INDEXING_REQUEST_HEADER]: isTemporaryLandingIndexablePath(request.nextUrl.pathname) ? null : 'noindex',
  })

const nextWithTemporaryLandingPublicHeaders = (
  request: NextRequest,
  publicMode: PublicSiteMode = 'holding',
  translationSource: string | null = null,
): NextResponse =>
  nextWithRequestHeaders(request, {
    [CMS_TRANSLATION_SOURCE_HEADER]: translationSource,
    [HOLDING_VIEW_REQUEST_HEADER]: 'public',
    [PUBLIC_SITE_MODE_REQUEST_HEADER]: publicMode,
    [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: publicMode === 'holding' ? '1' : null,
  })

const nextWithPublicMode = (
  request: NextRequest,
  publicMode: PublicSiteMode,
  translationSource: string | null,
): NextResponse =>
  nextWithRequestHeaders(request, {
    [CMS_TRANSLATION_SOURCE_HEADER]: translationSource,
    [PUBLIC_SITE_MODE_REQUEST_HEADER]: publicMode,
    [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: null,
  })

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (request.method === 'OPTIONS' && isPathFamily(pathname, '/api')) {
    return nextWithRequestHeaders(request, {})
  }

  if (shouldBypassProxy(pathname)) {
    return nextWithRequestHeaders(request, {})
  }

  if (isPathFamily(pathname, '/api')) return nextWithRequestHeaders(request, {})

  logCrawlerRequest(request)

  const previewDeployment = isPreviewRuntime()
  const discovery =
    PUBLIC_DISCOVERY_PATHS.has(pathname) ||
    isTemporaryLandingPublicDiscoveryPath(pathname) ||
    pathname.endsWith('-sitemap.xml')
  let verifiedUser: Promise<User | null> | undefined
  const getVerifiedUser = () => (verifiedUser ??= getHoldingRequestUser(request))
  const holdingMode = (
    await resolveHoldingMode(request.nextUrl, process.env, discovery ? undefined : request.headers, getVerifiedUser)
  ).mode
  const privateResponse = (response: NextResponse): NextResponse => {
    if (!discovery) response.headers.set('Cache-Control', 'private, no-store')
    return response
  }

  if (
    holdingMode === 'holding' &&
    temporaryLandingLocaleFromPath(pathname) &&
    !isPlatformUser(await getVerifiedUser())
  ) {
    const legacyLocation =
      request.method === 'GET' || request.method === 'HEAD' ? getLegacyTemporaryLandingLocation(request.nextUrl) : null
    const response = legacyLocation
      ? NextResponse.redirect(new URL(legacyLocation, request.url), 307)
      : nextWithTemporaryLandingHeaders(request, holdingMode)
    return privateResponse(previewDeployment ? withSearchRobotsHeader(response) : response)
  }

  let translationSource: string | null = null
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    !request.cookies.has('__prerender_bypass') &&
    !discovery &&
    (holdingMode === 'full' || isTemporaryLandingIndexablePath(pathname))
  ) {
    const source = parseCmsRedirectPath(pathname)
    if (source) {
      const result = await requestCmsRedirect(request, source, holdingMode === 'holding')
      if (result?.status === 200) {
        translationSource = result.path
      } else if (result) {
        const response = NextResponse.redirect(new URL(result.path, request.url), result.status)
        return privateResponse(previewDeployment ? withSearchRobotsHeader(response) : response)
      }
    }
  }

  if (holdingMode === 'full') {
    const response = nextWithPublicMode(request, holdingMode, translationSource)
    return privateResponse(previewDeployment || translationSource ? withSearchRobotsHeader(response) : response)
  }

  const platformUser = isPlatformUser(await getVerifiedUser())

  if (holdingMode === 'holding' && !platformUser) {
    if (isTemporaryLandingPublicExemptPath(pathname)) {
      if (isTemporaryLandingIndexablePath(pathname)) {
        const response = nextWithTemporaryLandingPublicHeaders(request, holdingMode, translationSource)
        return privateResponse(previewDeployment || translationSource ? withSearchRobotsHeader(response) : response)
      }

      return privateResponse(withSearchRobotsHeader(nextWithTemporaryLandingHeaders(request, holdingMode)))
    }

    if (
      isTemporaryLandingModeExemptPath(pathname) ||
      patientAuthLocaleFromPath(pathname, request.nextUrl.searchParams) === 'en'
    ) {
      return privateResponse(withSearchRobotsHeader(nextWithTemporaryLandingHeaders(request, holdingMode)))
    }

    return privateResponse(withSearchRobotsHeader(new NextResponse('Not Found', { status: 404 })))
  }

  return privateResponse(withSearchRobotsHeader(nextWithPublicMode(request, holdingMode, translationSource)))
}

export const config = {
  matcher: ['/api/:path*', '/((?!api(?:/|$)|_next/static|_next/image|_next/data).*)'],
}
