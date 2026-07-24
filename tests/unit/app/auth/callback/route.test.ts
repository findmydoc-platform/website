import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { exchangeCodeForSessionMock } = vi.hoisted(() => ({
  exchangeCodeForSessionMock: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
    },
  }),
}))

import { GET } from '@/app/auth/callback/route'

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to internal reset path for protocol-relative next path', async () => {
    const request = new NextRequest('http://localhost/auth/callback?next=//evil.example')

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/auth/password/reset/complete')
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled()
  })

  it('falls back to internal reset path for absolute external next path', async () => {
    const request = new NextRequest('http://localhost/auth/callback?next=https://evil.example/path')

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/auth/password/reset/complete')
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled()
  })

  it('redirects with a generic error when Supabase code exchange fails', async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({ error: { message: 'provider leaked details' } })

    const request = new NextRequest('http://localhost/auth/callback?code=bad-code')

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/password/reset/complete?error=auth_callback_failed',
    )
  })

  it.each([
    ['invite', '/auth/invite/complete'],
    ['recovery', '/auth/password/reset/complete'],
  ] as const)('stages %s TokenHash confirmation without consuming the token', async (type, next) => {
    const request = new NextRequest(`http://localhost/auth/callback?token_hash=secret-token&type=${type}&next=${next}`)

    const response = await GET(request)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`http://localhost/auth/confirm?type=${type}`)
    expect(response.headers.get('location')).not.toContain('secret-token')
    expect(response.headers.get('set-cookie')).toContain('findmydoc_auth_token_hash=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled()
  })

  it('rejects mismatched TokenHash flow destinations before verification', async () => {
    const request = new NextRequest(
      'http://localhost/auth/callback?token_hash=secret-token&type=invite&next=/auth/password/reset/complete',
    )

    const response = await GET(request)

    expect(response.headers.get('location')).toBe('http://localhost/auth/password/reset?reason=expired')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled()
  })
})
