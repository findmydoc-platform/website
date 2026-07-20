import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/password/reset/route'
import { createClient } from '@/auth/utilities/supaBaseServer'
import { getServerLogger } from '@/utilities/logging/serverLogger'
import { NextRequest } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'

const routeMocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  resolvePasswordResetTarget: vi.fn(),
}))

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: routeMocks.getPayload,
}))

vi.mock('@/auth/utilities/passwordResetTarget', () => ({
  resolvePasswordResetTarget: routeMocks.resolvePasswordResetTarget,
}))

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
  const originalClinicDashboardUrl = process.env.CLINIC_DASHBOARD_URL

  beforeEach(() => {
    vi.clearAllMocks()
    routeMocks.getPayload.mockResolvedValue({})
    routeMocks.resolvePasswordResetTarget.mockResolvedValue('website')
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as unknown as SupabaseClient)
    vi.mocked(getServerLogger).mockResolvedValue(logger)
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
    process.env.CLINIC_DASHBOARD_URL = 'https://dashboard.example.com'
  })

  afterEach(() => {
    if (originalServerUrl === undefined) Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_SERVER_URL')
    else process.env.NEXT_PUBLIC_SERVER_URL = originalServerUrl
    if (originalClinicDashboardUrl === undefined) Reflect.deleteProperty(process.env, 'CLINIC_DASHBOARD_URL')
    else process.env.CLINIC_DASHBOARD_URL = originalClinicDashboardUrl
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

  it('keeps password reset available for findmydoc.eu platform staff emails', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ error: null })

    const request = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operator@findmydoc.eu' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith('operator@findmydoc.eu', {
      redirectTo: 'http://localhost:3000/auth/callback?next=/auth/password/reset/complete',
    })
  })

  it('routes eligible clinic password resets to the Clinic Dashboard', async () => {
    routeMocks.resolvePasswordResetTarget.mockResolvedValueOnce('dashboard')
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ error: null })

    const request = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'clinic@example.com' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith('clinic@example.com', {
      redirectTo: 'https://dashboard.example.com/auth/callback?next=/auth/password/reset/complete',
    })
  })

  it('suppresses resets for blocked or ambiguous clinic identities', async () => {
    routeMocks.resolvePasswordResetTarget.mockResolvedValueOnce('suppress')

    const request = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'blocked-clinic@example.com' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(createClient).not.toHaveBeenCalled()
    expect(mockSupabaseClient.auth.resetPasswordForEmail).not.toHaveBeenCalled()
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

  it('returns a generic success response when Supabase rejects the reset request', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Unknown account' } })

    const request = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fail@example.com' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        emailHash: expect.any(String),
        event: 'auth.supabase.password_reset.rejected',
        scope: 'auth.supabase',
      }),
      'Password reset request was rejected by Supabase',
    )
  })

  it('returns a generic success response when Supabase throws during the reset request', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockRejectedValue(new Error('Unknown account'))

    const request = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'throw@example.com' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true })
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
