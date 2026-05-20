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
})
