import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/password/reset/route'
import { createClient } from '@/auth/utilities/supaBaseServer'

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: vi.fn(),
}))

type SupabaseMock = {
  auth: {
    resetPasswordForEmail: ReturnType<typeof vi.fn>
  }
}

describe('POST /api/auth/password/reset', () => {
  const resetPasswordForEmail = vi.fn()
  const originalRedirect = process.env.NEXT_PUBLIC_SUPABASE_RESET_REDIRECT

  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { resetPasswordForEmail },
    } as unknown as SupabaseMock)
    resetPasswordForEmail.mockReset()
    process.env.NEXT_PUBLIC_SUPABASE_RESET_REDIRECT = 'https://example.com/auth/password/reset/complete'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_RESET_REDIRECT = originalRedirect
    vi.clearAllMocks()
  })

  it('sends a password reset email when payload is valid', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null })

    const request = new Request('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.com' }),
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(resetPasswordForEmail).toHaveBeenCalledWith('person@example.com', {
      redirectTo: 'https://example.com/auth/password/reset/complete',
    })
  })

  it('returns validation errors for invalid payloads', async () => {
    const request = new Request('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Please provide a valid email address.')
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('bubbles up supabase errors', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: 'Unknown account' } })

    const request = new Request('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fail@example.com' }),
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Unknown account')
  })
})
