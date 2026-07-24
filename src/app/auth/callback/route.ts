import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/auth/utilities/supaBaseServer'
import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'
import {
  applyPrivateAuthHeaders,
  setPendingTokenHashCookie,
  validateTokenHashCallback,
} from '@/auth/utilities/tokenHashCallback'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = sanitizeInternalRedirectPath({
    nextPath: requestUrl.searchParams.get('next'),
    fallbackPath: '/auth/password/reset/complete',
  })
  const hasTokenHashParameters = requestUrl.searchParams.has('token_hash') || requestUrl.searchParams.has('type')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return applyPrivateAuthHeaders(
        NextResponse.redirect(`${requestUrl.origin}/auth/password/reset/complete?error=auth_callback_failed`),
      )
    }
  }

  if (!code && hasTokenHashParameters) {
    const callback = validateTokenHashCallback(request)
    if (!callback) {
      return applyPrivateAuthHeaders(NextResponse.redirect(`${requestUrl.origin}/auth/password/reset?reason=expired`))
    }

    const confirmationUrl = new URL('/auth/confirm', requestUrl.origin)
    confirmationUrl.searchParams.set('type', callback.type)
    const response = NextResponse.redirect(confirmationUrl, { status: 303 })
    setPendingTokenHashCookie(response, callback)
    return applyPrivateAuthHeaders(response)
  }

  // URL to redirect to after code exchange
  return applyPrivateAuthHeaders(NextResponse.redirect(`${requestUrl.origin}${next}`))
}
