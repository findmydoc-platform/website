import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/auth/utilities/supaBaseServer'
import {
  applyPrivateAuthHeaders,
  clearPendingTokenHashCookie,
  decodePendingTokenHash,
  TOKEN_HASH_CALLBACK_COOKIE,
} from '@/auth/utilities/tokenHashCallback'

function jsonResponse(body: unknown, status: number) {
  return applyPrivateAuthHeaders(NextResponse.json(body, { status }))
}

function isDefinitiveVerificationRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) return false

  const status = error.status
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429
}

export async function POST(request: NextRequest) {
  if (
    request.headers.get('origin') !== request.nextUrl.origin ||
    !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
  ) {
    return jsonResponse({ code: 'REQUEST_REJECTED' }, 403)
  }

  const callback = decodePendingTokenHash(request.cookies.get(TOKEN_HASH_CALLBACK_COOKIE)?.value)
  if (!callback) return jsonResponse({ code: 'INVALID_OR_EXPIRED_LINK' }, 400)

  let verificationError: unknown
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: callback.tokenHash,
      type: callback.type,
    })
    verificationError = error
  } catch {
    return jsonResponse({ code: 'VERIFICATION_TEMPORARILY_UNAVAILABLE' }, 503)
  }

  if (verificationError && !isDefinitiveVerificationRejection(verificationError)) {
    return jsonResponse({ code: 'VERIFICATION_TEMPORARILY_UNAVAILABLE' }, 503)
  }

  const response = verificationError
    ? jsonResponse({ code: 'INVALID_OR_EXPIRED_LINK' }, 400)
    : jsonResponse({ redirectTo: callback.next }, 200)
  clearPendingTokenHashCookie(response)
  return response
}
