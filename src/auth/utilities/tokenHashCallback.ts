import type { NextRequest, NextResponse } from 'next/server'

export const TOKEN_HASH_CALLBACK_COOKIE = 'findmydoc_auth_token_hash'

const destinations = {
  invite: '/auth/invite/complete',
  recovery: '/auth/password/reset/complete',
} as const

export type TokenHashFlow = keyof typeof destinations

export type PendingTokenHashCallback = Readonly<{
  next: (typeof destinations)[TokenHashFlow]
  tokenHash: string
  type: TokenHashFlow
}>

export function validateTokenHashCallback(request: NextRequest): PendingTokenHashCallback | null {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  const next = request.nextUrl.searchParams.get('next')

  if (!tokenHash || (type !== 'invite' && type !== 'recovery')) return null
  const expectedNext = destinations[type]
  if (next !== expectedNext) return null

  return { next: expectedNext, tokenHash, type }
}

export function encodePendingTokenHash(callback: PendingTokenHashCallback): string {
  return Buffer.from(JSON.stringify(callback), 'utf8').toString('base64url')
}

export function decodePendingTokenHash(value: string | undefined): PendingTokenHashCallback | null {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Record<string, unknown>
    if (candidate.type !== 'invite' && candidate.type !== 'recovery') return null
    if (candidate.next !== destinations[candidate.type] || typeof candidate.tokenHash !== 'string') return null
    if (!candidate.tokenHash) return null
    return {
      next: destinations[candidate.type],
      tokenHash: candidate.tokenHash,
      type: candidate.type,
    }
  } catch {
    return null
  }
}

export function setPendingTokenHashCookie(response: NextResponse, callback: PendingTokenHashCallback): void {
  response.cookies.set({
    httpOnly: true,
    maxAge: 10 * 60,
    name: TOKEN_HASH_CALLBACK_COOKIE,
    path: '/api/auth/callback',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    value: encodePendingTokenHash(callback),
  })
}

export function clearPendingTokenHashCookie(response: NextResponse): void {
  response.cookies.set({
    httpOnly: true,
    maxAge: 0,
    name: TOKEN_HASH_CALLBACK_COOKIE,
    path: '/api/auth/callback',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    value: '',
  })
}

export function applyPrivateAuthHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Expires', '0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
