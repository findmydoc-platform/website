import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import {
  buildPreviewGuardLoginRedirect,
  isAllowedPreviewUser,
  isPreviewGuardEnabled,
  isPreviewGuardExemptPath,
  PREVIEW_GUARD_LOCK_REQUEST_HEADER,
} from '@/features/previewGuard'

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

const nextWithGuardLockHeader = (request: NextRequest): NextResponse => {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(PREVIEW_GUARD_LOCK_REQUEST_HEADER, '1')
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (shouldBypassProxy(pathname)) {
    return NextResponse.next()
  }

  if (!isPreviewGuardEnabled(process.env)) {
    return NextResponse.next()
  }

  const user = await getPreviewUser(request)
  if (isAllowedPreviewUser(user)) {
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
