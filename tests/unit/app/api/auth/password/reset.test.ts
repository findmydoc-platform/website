import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/password/reset/route'
import { createClient } from '@/auth/utilities/supaBaseServer'
import { getServerLogger } from '@/utilities/logging/serverLogger'
import { NextRequest } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/utilities/logging/serverLogger', () => ({
  getServerLogger: vi.fn(),
}))

describe('POST /api/auth/password/reset', () => {
  const mockSupabaseClient = {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  }
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    level: 'info',
    trace: vi.fn(),
    warn: vi.fn(),
  }

  const originalServerUrl = process.env.NEXT_PUBLIC_SERVER_URL

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as unknown as SupabaseClient)
    vi.mocked(getServerLogger).mockResolvedValue(logger)
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SERVER_URL = originalServerUrl
    vi.clearAllMocks()
  })

  it('sends a password reset email when payload is valid', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ error: null })

    const request = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.com' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.com', {
      redirectTo: 'http://localhost:3000/auth/callback?next=/auth/password/reset/complete',
    })
  })

  it('returns validation errors for invalid payloads', async () => {
    const request = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Please provide a valid email address.')
    expect(mockSupabaseClient.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('bubbles up supabase errors', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Unknown account' } })

    const request = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fail@example.com' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Unknown account')
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        emailHash: expect.any(String),
        event: 'auth.supabase.password_reset.rejected',
        scope: 'auth.supabase',
      }),
      'Password reset request was rejected by Supabase',
    )
  })

  it('logs structured errors when the request fails unexpectedly', async () => {
    vi.mocked(createClient).mockRejectedValueOnce(new Error('supabase unavailable'))

    const request = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fail@example.com' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Internal server error')
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        emailHash: expect.any(String),
        event: 'auth.supabase.password_reset.failed',
        scope: 'auth.supabase',
      }),
      'Password reset request failed',
    )
  })
})
