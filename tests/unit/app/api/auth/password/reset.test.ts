import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/password/reset/route'
import { createClient } from '@/auth/utilities/supaBaseServer'

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: vi.fn(),
}))

describe('POST /api/auth/password/reset', () => {
  const mockSupabaseClient = {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  }

  const originalServerUrl = process.env.NEXT_PUBLIC_SERVER_URL

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SERVER_URL = originalServerUrl
    vi.clearAllMocks()
  })

  it('sends a password reset email when payload is valid', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ error: null })

    const request = new Request('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.com' }),
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.com', {
      redirectTo: 'http://localhost:3000/auth/callback?next=/auth/password/reset/complete',
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
    expect(mockSupabaseClient.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('bubbles up supabase errors', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Unknown account' } })

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
