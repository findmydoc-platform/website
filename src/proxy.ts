import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

import { isPlatformUser } from '@/auth/utilities/supabaseAuthPolicy'
import { isPreviewRuntime } from '@/features/runtimePolicy'
import {
  HOLDING_VIEW_REQUEST_HEADER,
  isTemporaryLandingModeExemptPath,
  isTemporaryLandingIndexablePath,
  isTemporaryLandingPublicExemptPath,
  isTemporaryLandingPublicDiscoveryPath,
  isTemporaryLandingRootPath,
  TEMPORARY_LANDING_MODE_REQUEST_HEADER,
  PUBLIC_SITE_MODE_REQUEST_HEADER,
} from '@/features/temporaryLandingMode'
import { resolveHoldingMode, type PublicSiteMode } from '@/features/temporaryLandingMode/resolver'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { logCrawlerRequest } from '@/features/publicDiscovery/crawlerMonitoring'

const NON_PAGE_PATHS = new Set(['/next/exit-preview', '/next/preview'])

const isPathFamily = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

const shouldBypassProxy = (pathname: string): boolean => {
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (isPathFamily(pathname, '/_next')) return true
  if (NON_PAGE_PATHS.has(normalizedPath)) return true
  // Next replaces this inventory with the actual public asset URLs during compilation.
  const publicStaticAssetPaths: string[] = JSON.parse(process.env.PUBLIC_STATIC_ASSET_PATHS ?? '[]')
  if (publicStaticAssetPaths.includes(pathname)) return true
  return false
}

const getHoldingRequestUser = async (request: NextRequest): Promise<User | null> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll() {
        // Holding only reads the server-validated session for its platform staff exception.
      },
    },
  })
  try {
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
  requestHeaders.delete(PUBLIC_SITE_MODE_REQUEST_HEADER)
  requestHeaders.delete(TEMPORARY_LANDING_MODE_REQUEST_HEADER)
  requestHeaders.delete(HOLDING_VIEW_REQUEST_HEADER)
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
  })

const nextWithTemporaryLandingPublicHeaders = (
  request: NextRequest,
  publicMode: PublicSiteMode = 'holding',
): NextResponse =>
  nextWithRequestHeaders(request, {
    [HOLDING_VIEW_REQUEST_HEADER]: 'public',
    [PUBLIC_SITE_MODE_REQUEST_HEADER]: publicMode,
    [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: publicMode === 'holding' ? '1' : null,
  })

const nextWithPublicMode = (request: NextRequest, publicMode?: PublicSiteMode): NextResponse =>
  nextWithRequestHeaders(request, {
    [PUBLIC_SITE_MODE_REQUEST_HEADER]: publicMode ?? null,
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
    isTemporaryLandingPublicDiscoveryPath(pathname) || pathname === '/llms.txt' || pathname.endsWith('-sitemap.xml')
  const holdingMode = (await resolveHoldingMode(request.nextUrl, process.env, discovery ? undefined : request.headers))
    .mode
  const privateResponse = (response: NextResponse): NextResponse => {
    if (!discovery) response.headers.set('Cache-Control', 'private, no-store')
    return response
  }

  if (holdingMode === 'full') {
    const response = nextWithPublicMode(request, holdingMode)
    return privateResponse(previewDeployment ? withSearchRobotsHeader(response) : response)
  }

  const platformUser = isPlatformUser(await getHoldingRequestUser(request))

  if (holdingMode === 'holding' && !platformUser) {
    if (isTemporaryLandingRootPath(pathname) || isTemporaryLandingPublicExemptPath(pathname)) {
      if (isTemporaryLandingIndexablePath(pathname)) {
        const response = nextWithTemporaryLandingPublicHeaders(request, holdingMode)
        return privateResponse(previewDeployment ? withSearchRobotsHeader(response) : response)
      }

      return privateResponse(withSearchRobotsHeader(nextWithTemporaryLandingHeaders(request, holdingMode)))
    }

    if (isTemporaryLandingModeExemptPath(pathname)) {
      return privateResponse(withSearchRobotsHeader(nextWithTemporaryLandingHeaders(request, holdingMode)))
    }

    return privateResponse(withSearchRobotsHeader(new NextResponse('Not Found', { status: 404 })))
  }

  return privateResponse(withSearchRobotsHeader(nextWithPublicMode(request, holdingMode)))
}

export const config = {
  matcher: ['/api/:path*', '/((?!api(?:/|$)|_next/static|_next/image|_next/data).*)'],
}
