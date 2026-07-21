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
  } catch (error) {
    verificationError = error
  }

  const response = verificationError
    ? jsonResponse({ code: 'INVALID_OR_EXPIRED_LINK' }, 400)
    : jsonResponse({ redirectTo: callback.next }, 200)
  clearPendingTokenHashCookie(response)
  return response
}
