import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import {
  buildPreviewGuardLoginRedirect,
  isAllowedPreviewUser,
  isPreviewGuardEnabled,
  isPreviewGuardExemptPath,
  PREVIEW_GUARD_LOCK_REQUEST_HEADER,
} from '@/features/previewGuard'
import {
  isTemporaryLandingModeEnabled,
  isTemporaryLandingModeExemptPath,
  isTemporaryLandingRootPath,
  TEMPORARY_LANDING_MODE_REQUEST_HEADER,
} from '@/features/temporaryLandingMode'

const PUBLIC_FILE = /\.[^/]+$/

const shouldBypassProxy = (pathname: string): boolean => {
  if (pathname.startsWith('/api')) return true
  if (pathname.startsWith('/_next')) return true
  if (PUBLIC_FILE.test(pathname)) return true
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

  const previewGuardEnabled = isPreviewGuardEnabled(process.env)
  const temporaryLandingModeEnabled = isTemporaryLandingModeEnabled(process.env)

  if (!previewGuardEnabled && !temporaryLandingModeEnabled) {
    return NextResponse.next()
  }

  const user = await getPreviewUser(request)
  const isPlatformUser = isAllowedPreviewUser(user)

  if (temporaryLandingModeEnabled && !isPlatformUser) {
    if (isTemporaryLandingModeExemptPath(pathname)) {
      return nextWithGuardLockHeader(request)
    }

    if (isTemporaryLandingRootPath(pathname)) {
      return nextWithTemporaryLandingHeaders(request)
    }

    return new NextResponse('Not Found', { status: 404 })
  }

  if (!previewGuardEnabled) {
    return NextResponse.next()
  }

  if (isPlatformUser) {
    return NextResponse.next()
  }

  if (isPreviewGuardExemptPath(pathname)) {
    return nextWithGuardLockHeader(request)
  }

  const redirectTarget = buildPreviewGuardLoginRedirect(request.nextUrl)
  return NextResponse.redirect(new URL(redirectTarget, request.url))
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
}
