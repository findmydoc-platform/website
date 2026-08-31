import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

import {
  extractTokenFromHeader,
  isTemporarySupabaseAuthError,
  validateSupabaseUser,
} from '@/auth/utilities/supabaseAuthPolicy'
import {
  buildPreviewGuardLoginRedirect,
  buildPreviewGuardPatientLoginRedirect,
  classifyPreviewGuardPagePath,
  isAllowedPreviewPatient,
  isAllowedPreviewUser,
  isPreviewDeployment,
  isPreviewGuardAnonymousApiPath,
  isPreviewGuardEndpointAuthApiPath,
  isPreviewGuardPatientRegistrationApiPath,
  isPreviewGuardScannerPath,
  PREVIEW_GUARD_ACTIVE_REQUEST_HEADER,
  PREVIEW_GUARD_LOCK_REQUEST_HEADER,
  resolveDeploymentEnvironment,
} from '@/features/previewGuard'
import {
  isTemporaryLandingModeExemptPath,
  isTemporaryLandingPublicExemptPath,
  isTemporaryLandingRootPath,
  TEMPORARY_LANDING_MODE_REQUEST_HEADER,
} from '@/features/temporaryLandingMode'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import {
  createPostHogFlagEvaluationContext,
  evaluatePostHogFlags,
  resolvePostHogSiteFlagActor,
  type PostHogFlagKey,
} from '@/posthog/api'
import { logCrawlerRequest } from '@/features/publicDiscovery/crawlerMonitoring'

const GUARD_FLAG_KEYS = ['temporary-landing-mode', 'preview-guard-enabled'] as const satisfies readonly PostHogFlagKey[]
const NON_PAGE_PATHS = new Set(['/next/exit-preview', '/next/preview'])
const PUBLIC_ASSET_PATHS = new Set([
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/findmydoc-og.jpg',
  '/findmydoc-og.webp',
  '/images/avatar-patient-female-placeholder.svg',
  '/images/avatar-patient-male-placeholder.svg',
  '/images/avatar-placeholder.svg',
  '/images/blog-header-clinic-reception.webp',
  '/images/blog-placeholder-1600-900.svg',
  '/images/clinic-detail/contact-fallback-home-image30.jpg',
  '/images/clinic-detail/clinic-location-placeholder-map.webp',
  '/images/clinic-registration-funnel-panel.webp',
  '/images/holding-page/E105NVPR.jpg',
  '/images/holding-page/immersive-hero-loop.mp4',
  '/images/our-process-gradient.png',
  '/images/placeholders/clinic-placeholder.webp',
  '/images/placeholders/doctor-female-placeholder.webp',
  '/images/placeholders/doctor-male-placeholder.webp',
  '/images/placeholders/doctor-neutral-placeholder.webp',
  '/images/process-step-1.svg',
  '/images/process-step-2.svg',
  '/images/process-step-3.svg',
  '/images/process-step-4.svg',
  '/fmd-icon-1-dark.png',
  '/fmd-icon-1-white.png',
  '/fmd-logo-1-dark.png',
  '/fmd-logo-1-dark.svg',
  '/fmd-logo-1-white.png',
  '/social/findmydoc-square.jpg',
  '/social/findmydoc-wide.jpg',
  '/stories/flower.mp4',
  '/stories/immersive-hero-loop.mp4',
])

const isPublicAssetPath = (pathname: string): boolean => {
  return PUBLIC_ASSET_PATHS.has(pathname)
}

const isPathFamily = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

const shouldBypassProxy = (pathname: string): boolean => {
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (isPathFamily(pathname, '/_next')) return true
  if (NON_PAGE_PATHS.has(normalizedPath)) return true
  if (isPublicAssetPath(pathname)) return true
  return false
}

const hasSupabaseSessionCookie = (request: NextRequest): boolean =>
  request.cookies.getAll().some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'))

type PreviewUserLookup = {
  error: unknown
  unavailable: boolean
  user: User | null
}

const lookupPreviewUser = async (request: NextRequest, accessToken?: string): Promise<PreviewUserLookup> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: null, unavailable: true, user: null }
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll() {
        // Proxy only needs a session check for routing decisions.
      },
    },
  })

  try {
    const {
      data: { user },
      error,
    } = accessToken ? await supabase.auth.getUser(accessToken) : await supabase.auth.getUser()

    return {
      error,
      unavailable: isTemporarySupabaseAuthError(error),
      user: error ? null : user,
    }
  } catch (error) {
    return { error, unavailable: true, user: null }
  }
}

const getPreviewUser = async (request: NextRequest): Promise<User | null> => (await lookupPreviewUser(request)).user

const nextWithRequestHeaders = (request: NextRequest, headersToSet: Record<string, string | null>): NextResponse => {
  const requestHeaders = new Headers(request.headers)
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

const nextWithGuardActiveHeader = (request: NextRequest): NextResponse =>
  nextWithRequestHeaders(request, {
    [PREVIEW_GUARD_ACTIVE_REQUEST_HEADER]: '1',
    [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: null,
    [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: null,
  })

const nextWithGuardLockHeader = (request: NextRequest): NextResponse =>
  nextWithRequestHeaders(request, {
    [PREVIEW_GUARD_ACTIVE_REQUEST_HEADER]: '1',
    [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: '1',
    [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: null,
  })

const nextWithTemporaryLandingHeaders = (request: NextRequest): NextResponse =>
  nextWithRequestHeaders(request, {
    [PREVIEW_GUARD_ACTIVE_REQUEST_HEADER]: null,
    [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: '1',
    [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1',
  })

const nextWithoutGuardHeaders = (request: NextRequest): NextResponse =>
  nextWithRequestHeaders(request, {
    [PREVIEW_GUARD_ACTIVE_REQUEST_HEADER]: null,
    [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: null,
    [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: null,
  })

const previewApiError = (message: string, status: 401 | 503): NextResponse => {
  const response = NextResponse.json({ error: message }, { status })
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Vary', 'Authorization, Cookie')
  return response
}

const handlePreviewApiRequest = async (request: NextRequest): Promise<NextResponse> => {
  const { pathname } = request.nextUrl

  if (isPreviewGuardPatientRegistrationApiPath(pathname)) return nextWithGuardActiveHeader(request)

  if (isPreviewGuardAnonymousApiPath(pathname) || isPreviewGuardEndpointAuthApiPath(pathname)) {
    return nextWithGuardActiveHeader(request)
  }

  const authorization = request.headers.get('authorization')
  const accessToken = extractTokenFromHeader(request.headers)
  if (
    (authorization !== null && accessToken === undefined) ||
    (authorization === null && !hasSupabaseSessionCookie(request))
  ) {
    return previewApiError('Unauthorized', 401)
  }

  const { unavailable, user } = await lookupPreviewUser(request, accessToken)
  if (unavailable) return previewApiError('Authentication service unavailable', 503)
  if (!validateSupabaseUser(user)) return previewApiError('Unauthorized', 401)

  return nextWithGuardActiveHeader(request)
}

const evaluateGuardFlagsForRequest = async (request: NextRequest) => {
  const flagContext = createPostHogFlagEvaluationContext({ url: request.nextUrl })
  const actor = resolvePostHogSiteFlagActor(flagContext)
  const flags = await evaluatePostHogFlags(actor, GUARD_FLAG_KEYS, { context: flagContext })

  return {
    previewGuardFlagEnabled: flags.isEnabled('preview-guard-enabled'),
    temporaryLandingModeEnabled: flags.isEnabled('temporary-landing-mode'),
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (isPreviewGuardScannerPath(pathname)) {
    return withSearchRobotsHeader(new NextResponse(null, { status: 404 }))
  }

  if (request.method === 'OPTIONS' && isPathFamily(pathname, '/api')) {
    return NextResponse.next()
  }

  if (shouldBypassProxy(pathname)) {
    return NextResponse.next()
  }

  if (isPathFamily(pathname, '/api')) {
    if (!isPreviewDeployment()) {
      if (!isPreviewGuardPatientRegistrationApiPath(pathname)) return NextResponse.next()

      const { previewGuardFlagEnabled } = await evaluateGuardFlagsForRequest(request)
      const previewGuardEnabled = resolveDeploymentEnvironment() !== 'development' && previewGuardFlagEnabled
      return previewGuardEnabled ? nextWithGuardActiveHeader(request) : nextWithoutGuardHeaders(request)
    }

    return handlePreviewApiRequest(request)
  }

  logCrawlerRequest(request)

  const pagePathClassification = classifyPreviewGuardPagePath(pathname)
  if (pagePathClassification === 'not-found') {
    return withSearchRobotsHeader(new NextResponse(null, { status: 404 }))
  }

  const previewDeployment = isPreviewDeployment()
  let temporaryLandingModeEnabled = false
  let previewGuardFlagEnabled = false

  if (!previewDeployment) {
    const flagState = await evaluateGuardFlagsForRequest(request)
    temporaryLandingModeEnabled = flagState.temporaryLandingModeEnabled
    previewGuardFlagEnabled = flagState.previewGuardFlagEnabled
  }

  const previewGuardEnabled =
    previewDeployment || (resolveDeploymentEnvironment() !== 'development' && previewGuardFlagEnabled)

  if (!previewGuardEnabled && !temporaryLandingModeEnabled) {
    return nextWithoutGuardHeaders(request)
  }

  if (previewGuardEnabled && pagePathClassification === 'exempt') {
    return withSearchRobotsHeader(nextWithGuardLockHeader(request))
  }

  if (previewGuardEnabled && pagePathClassification === 'dynamic-content' && !hasSupabaseSessionCookie(request)) {
    return withSearchRobotsHeader(new NextResponse(null, { status: 404 }))
  }

  const user = await getPreviewUser(request)
  const isPlatformUser = isAllowedPreviewUser(user)
  const isPatientUser = isAllowedPreviewPatient(user)
  const isPatientPath = pagePathClassification === 'patient'

  if (previewGuardEnabled) {
    if (isPlatformUser) {
      return withSearchRobotsHeader(nextWithGuardActiveHeader(request))
    }

    if (isPatientPath) {
      if (isPatientUser) {
        return withSearchRobotsHeader(nextWithGuardActiveHeader(request))
      }

      const redirectTarget = user
        ? buildPreviewGuardLoginRedirect(request.nextUrl)
        : buildPreviewGuardPatientLoginRedirect(request.nextUrl)
      return withSearchRobotsHeader(NextResponse.redirect(new URL(redirectTarget, request.url)))
    }

    if (pagePathClassification === 'dynamic-content') {
      return withSearchRobotsHeader(new NextResponse(null, { status: 404 }))
    }

    const redirectTarget = buildPreviewGuardLoginRedirect(request.nextUrl)
    return withSearchRobotsHeader(NextResponse.redirect(new URL(redirectTarget, request.url)))
  }

  if (temporaryLandingModeEnabled && !isPlatformUser) {
    if (isTemporaryLandingRootPath(pathname) || isTemporaryLandingPublicExemptPath(pathname)) {
      return withSearchRobotsHeader(nextWithTemporaryLandingHeaders(request))
    }

    if (isTemporaryLandingModeExemptPath(pathname)) {
      return withSearchRobotsHeader(nextWithTemporaryLandingHeaders(request))
    }

    return withSearchRobotsHeader(new NextResponse('Not Found', { status: 404 }))
  }

  return withSearchRobotsHeader(nextWithoutGuardHeaders(request))
}

export const config = {
  matcher: ['/api/:path*', '/((?!api(?:/|$)|_next/static|_next/image|_next/data).*)'],
}
