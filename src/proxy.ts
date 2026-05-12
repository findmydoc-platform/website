import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import {
  buildPreviewGuardLoginRedirect,
  isAllowedPreviewUser,
  isPreviewGuardExemptPath,
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

const GUARD_FLAG_KEYS = ['temporary-landing-mode', 'preview-guard-enabled'] as const satisfies readonly PostHogFlagKey[]
const PUBLIC_ASSET_PATHS = new Set([
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/findmydoc-og.webp',
  '/images/avatar-doctor-female-placeholder.svg',
  '/images/avatar-doctor-male-placeholder.svg',
  '/images/avatar-patient-female-placeholder.svg',
  '/images/avatar-patient-male-placeholder.svg',
  '/images/avatar-placeholder.svg',
  '/images/blog-placeholder-1600-900.svg',
  '/images/clinic-detail/contact-fallback-doctor.jpg',
  '/images/clinic-detail/contact-fallback-home-image30.jpg',
  '/images/holding-page/E105NVPR.jpg',
  '/images/holding-page/immersive-hero-loop.mp4',
  '/images/our-process-gradient.png',
  '/images/placeholder-576-968.svg',
  '/images/process-step-1.svg',
  '/images/process-step-2.svg',
  '/images/process-step-3.svg',
  '/images/process-step-4.svg',
  '/fmd-icon-1-dark.png',
  '/fmd-icon-1-white.png',
  '/fmd-logo-1-dark.png',
  '/fmd-logo-1-dark.svg',
  '/fmd-logo-1-white.png',
  '/stories/flower.mp4',
  '/stories/immersive-hero-loop.mp4',
])

const isPublicAssetPath = (pathname: string): boolean => {
  return PUBLIC_ASSET_PATHS.has(pathname)
}

const shouldBypassProxy = (pathname: string): boolean => {
  if (pathname.startsWith('/api')) return true
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

const nextWithRequestHeaders = (request: NextRequest, headersToSet: Record<string, string>): NextResponse => {
  const requestHeaders = new Headers(request.headers)
  Object.entries(headersToSet).forEach(([key, value]) => {
    requestHeaders.set(key, value)
  })

  return NextResponse.next({ request: { headers: requestHeaders } })
}

const withSearchRobotsHeader = (response: NextResponse): NextResponse => {
  response.headers.set(SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE)
  return response
}

const nextWithGuardLockHeader = (request: NextRequest): NextResponse =>
  nextWithRequestHeaders(request, { [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: '1' })

const nextWithTemporaryLandingHeaders = (request: NextRequest): NextResponse =>
  nextWithRequestHeaders(request, {
    [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: '1',
    [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1',
  })

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (shouldBypassProxy(pathname)) {
    return NextResponse.next()
  }

  const flagContext = createPostHogFlagEvaluationContext({ url: request.nextUrl })
  const actor = resolvePostHogSiteFlagActor(flagContext)
  const flags = await evaluatePostHogFlags(actor, GUARD_FLAG_KEYS, { context: flagContext })
  const temporaryLandingModeEnabled = flags.isEnabled('temporary-landing-mode')
  const previewGuardEnabled = flags.isEnabled('preview-guard-enabled')

  if (!previewGuardEnabled && !temporaryLandingModeEnabled) {
    return NextResponse.next()
  }

  const user = await getPreviewUser(request)
  const isPlatformUser = isAllowedPreviewUser(user)

  if (temporaryLandingModeEnabled && !isPlatformUser) {
    if (isTemporaryLandingRootPath(pathname) || isTemporaryLandingPublicExemptPath(pathname)) {
      return withSearchRobotsHeader(nextWithTemporaryLandingHeaders(request))
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
    return withSearchRobotsHeader(NextResponse.next())
  }

  if (isPlatformUser) {
    return withSearchRobotsHeader(NextResponse.next())
  }

  if (isPreviewGuardExemptPath(pathname)) {
    return withSearchRobotsHeader(nextWithGuardLockHeader(request))
  }

  const redirectTarget = buildPreviewGuardLoginRedirect(request.nextUrl)
  return withSearchRobotsHeader(NextResponse.redirect(new URL(redirectTarget, request.url)))
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|_next/data).*)'],
}
