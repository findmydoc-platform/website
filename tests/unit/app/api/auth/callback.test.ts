import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { verifyOtpMock } = vi.hoisted(() => ({
  verifyOtpMock: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { verifyOtp: verifyOtpMock } }),
}))

import { POST } from '@/app/api/auth/callback/route'

function pendingCookie(type: 'invite' | 'recovery') {
  const next = type === 'invite' ? '/auth/invite/complete' : '/auth/password/reset/complete'
  const value = Buffer.from(JSON.stringify({ next, tokenHash: 'secret-token-hash', type })).toString('base64url')
  return { next, value }
}

function request(type: 'invite' | 'recovery', origin = 'http://localhost') {
  const pending = pendingCookie(type)
  return {
    next: pending.next,
    request: new NextRequest('http://localhost/api/auth/callback', {
      body: '{}',
      headers: {
        'content-type': 'application/json',
        cookie: `findmydoc_auth_token_hash=${pending.value}`,
        origin,
      },
      method: 'POST',
    }),
  }
}

describe('POST /api/auth/callback', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(['invite', 'recovery'] as const)('verifies %s only after same-origin POST', async (type) => {
    const input = request(type)
    const response = await POST(input.request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ redirectTo: input.next })
    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: 'secret-token-hash', type })
    expect(response.headers.get('set-cookie')).toContain('findmydoc_auth_token_hash=;')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('rejects cross-origin requests without calling Supabase', async () => {
    const response = await POST(request('invite', 'https://attacker.example').request)
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ code: 'REQUEST_REJECTED' })
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })

  it('clears the pending callback after a definitive provider rejection', async () => {
    verifyOtpMock.mockResolvedValueOnce({
      error: { message: 'provider details', status: 400 },
    })
    const response = await POST(request('recovery').request)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ code: 'INVALID_OR_EXPIRED_LINK' })
    expect(response.headers.get('set-cookie')).toContain('findmydoc_auth_token_hash=;')
  })

  it.each([
    {
      error: { message: 'rate limited', status: 429 },
      label: 'a rate limit response',
    },
    {
      error: { message: 'upstream unavailable', status: 503 },
      label: 'an upstream failure',
    },
    {
      error: { message: 'fetch failed' },
      label: 'an unclassified provider failure',
    },
  ])('retains the pending callback after $label', async ({ error }) => {
    verifyOtpMock.mockResolvedValueOnce({ error })
    const response = await POST(request('recovery').request)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      code: 'VERIFICATION_TEMPORARILY_UNAVAILABLE',
    })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('retains the pending callback after a thrown transport failure', async () => {
    verifyOtpMock.mockRejectedValueOnce(new Error('connection closed'))
    const response = await POST(request('invite').request)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      code: 'VERIFICATION_TEMPORARILY_UNAVAILABLE',
    })
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
