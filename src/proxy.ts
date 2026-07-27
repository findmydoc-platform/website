import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import {
  buildPreviewGuardLoginRedirect,
  buildPreviewGuardPatientLoginRedirect,
  isAllowedPreviewPatient,
  isAllowedPreviewUser,
  isPreviewGuardExemptPath,
  isPreviewGuardPatientPath,
  isPreviewGuardPatientRegistrationApiPath,
  PREVIEW_GUARD_ACTIVE_REQUEST_HEADER,
  PREVIEW_GUARD_LOCK_REQUEST_HEADER,
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
const FIRST_ADMIN_BOOTSTRAP_PATHS = new Set(['/admin/create-first-user', '/admin/first-admin'])
const PUBLIC_ASSET_PATHS = new Set([
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/findmydoc-og.jpg',
  '/findmydoc-og.webp',
  '/images/avatar-patient-female-placeholder.svg',
  '/images/avatar-patient-male-placeholder.svg',
  '/images/avatar-placeholder.svg',
  '/images/blog-placeholder-1600-900.svg',
  '/images/clinic-detail/contact-fallback-home-image30.jpg',
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

const isFirstAdminBootstrapPath = (pathname: string): boolean => {
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return FIRST_ADMIN_BOOTSTRAP_PATHS.has(normalizedPath)
}

const shouldBypassProxy = (pathname: string): boolean => {
  if (pathname.startsWith('/api') && !isPreviewGuardPatientRegistrationApiPath(pathname)) return true
  if (pathname.startsWith('/_next')) return true
  if (isPublicAssetPath(pathname)) return true
  return false
}

const getPreviewUser = async (request: NextRequest) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

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

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) return null
  return user
}

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

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (shouldBypassProxy(pathname)) {
    return NextResponse.next()
  }

  logCrawlerRequest(request)

  if (isFirstAdminBootstrapPath(pathname)) {
    return withSearchRobotsHeader(new NextResponse(null, { status: 404 }))
  }

  const flagContext = createPostHogFlagEvaluationContext({ url: request.nextUrl })
  const actor = resolvePostHogSiteFlagActor(flagContext)
  const flags = await evaluatePostHogFlags(actor, GUARD_FLAG_KEYS, { context: flagContext })
  const temporaryLandingModeEnabled = flags.isEnabled('temporary-landing-mode')
  const previewGuardEnabled = flags.isEnabled('preview-guard-enabled')

  if (!previewGuardEnabled && !temporaryLandingModeEnabled) {
    return nextWithoutGuardHeaders(request)
  }

  if (isPreviewGuardPatientRegistrationApiPath(pathname)) {
    return previewGuardEnabled ? nextWithGuardActiveHeader(request) : nextWithoutGuardHeaders(request)
  }

  const user = await getPreviewUser(request)
  const isPlatformUser = isAllowedPreviewUser(user)
  const isPatientUser = isAllowedPreviewPatient(user)
  const isPatientPath = isPreviewGuardPatientPath(pathname)

  if (temporaryLandingModeEnabled && !isPlatformUser) {
    if (isTemporaryLandingRootPath(pathname) || isTemporaryLandingPublicExemptPath(pathname)) {
      return withSearchRobotsHeader(nextWithTemporaryLandingHeaders(request))
    }

    if (previewGuardEnabled && isPatientPath) {
      if (isPatientUser) {
        return withSearchRobotsHeader(nextWithGuardLockHeader(request))
      }

      const redirectTarget = user
        ? buildPreviewGuardLoginRedirect(request.nextUrl)
        : buildPreviewGuardPatientLoginRedirect(request.nextUrl)
      return withSearchRobotsHeader(NextResponse.redirect(new URL(redirectTarget, request.url)))
    }

    if (previewGuardEnabled && isTemporaryLandingModeExemptPath(pathname)) {
      if (isPreviewGuardExemptPath(pathname)) {
        return withSearchRobotsHeader(nextWithGuardLockHeader(request))
      }

      const redirectTarget = buildPreviewGuardLoginRedirect(request.nextUrl)
      return withSearchRobotsHeader(NextResponse.redirect(new URL(redirectTarget, request.url)))
    }

    if (isTemporaryLandingModeExemptPath(pathname)) {
      return withSearchRobotsHeader(nextWithTemporaryLandingHeaders(request))
    }

    return withSearchRobotsHeader(new NextResponse('Not Found', { status: 404 }))
  }

  if (!previewGuardEnabled) {
    return withSearchRobotsHeader(nextWithoutGuardHeaders(request))
  }

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

  if (isPreviewGuardExemptPath(pathname)) {
    return withSearchRobotsHeader(nextWithGuardLockHeader(request))
  }

  const redirectTarget = buildPreviewGuardLoginRedirect(request.nextUrl)
  return withSearchRobotsHeader(NextResponse.redirect(new URL(redirectTarget, request.url)))
}

export const config = {
  matcher: ['/api/auth/register/patient', '/((?!api|_next/static|_next/image|_next/data).*)'],
}
