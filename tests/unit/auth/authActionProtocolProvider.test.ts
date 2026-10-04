import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { updateProtocolPassword, verifyProtocolUser } from '@/auth/actions/protocol/provider'

const subject = randomUUID()
const token = 'offline-session'
const password = 'offline-password'
const fetchBoundary = vi.fn<typeof fetch>()
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://auth.example.invalid')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'offline-public-key')
  vi.stubGlobal('fetch', fetchBoundary)
  fetchBoundary.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('auth-action ordinary Supabase boundary', () => {
  it('verifies current server authority using the supplied session and no stored client session', async () => {
    fetchBoundary.mockResolvedValueOnce(
      Response.json({ id: subject, email: 'synthetic@example.invalid', app_metadata: { user_type: 'clinic' } }),
    )
    expect(await verifyProtocolUser(token)).toMatchObject({ id: subject, app_metadata: { user_type: 'clinic' } })
    expect(fetchBoundary).toHaveBeenCalledOnce()
    const [url, init] = fetchBoundary.mock.calls[0]!
    expect(String(url)).toBe('https://auth.example.invalid/auth/v1/user')
    expect(init?.method).toBe('GET')
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${token}`)
    expect(init?.cache).toBe('no-store')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('observes one ordinary authenticated password PUT, without an Admin endpoint or retry', async () => {
    fetchBoundary.mockResolvedValueOnce(Response.json({ id: subject }))
    expect(await updateProtocolPassword(token, password)).toMatchObject({
      data: { user: { id: subject } },
      error: null,
    })
    expect(fetchBoundary).toHaveBeenCalledOnce()
    const [url, init] = fetchBoundary.mock.calls[0]!
    expect(String(url)).toBe('https://auth.example.invalid/auth/v1/user')
    expect(init?.method).toBe('PUT')
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${token}`)
    expect(new Headers(init?.headers).get('apikey')).toBe('offline-public-key')
    expect(init?.body).toBe(JSON.stringify({ password }))
    expect(init?.cache).toBe('no-store')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('reduces provider rejection to a closed status/code without retaining its sensitive detail', async () => {
    fetchBoundary.mockResolvedValueOnce(
      Response.json(
        { error_code: 'weak_password', message: password, email: 'synthetic@example.invalid' },
        { status: 422 },
      ),
    )
    expect(await updateProtocolPassword(token, password)).toEqual({
      data: { user: null },
      error: { status: 422, code: 'weak_password' },
    })
  })

  it('does not retry a lost password response or manufacture a success from a malformed response', async () => {
    fetchBoundary.mockRejectedValueOnce(new Error('Synthetic connection loss.'))
    await expect(updateProtocolPassword(token, password)).rejects.toThrow()
    expect(fetchBoundary).toHaveBeenCalledOnce()
    fetchBoundary.mockResolvedValueOnce(Response.json({ success: true }))
    await expect(updateProtocolPassword(token, password)).rejects.toThrow('Auth-action protocol unavailable.')
    expect(fetchBoundary).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid current sessions and distinguishes infrastructure failure internally', async () => {
    fetchBoundary.mockResolvedValueOnce(Response.json({ code: 'bad_jwt' }, { status: 401 }))
    expect(await verifyProtocolUser(token)).toBeNull()
    fetchBoundary.mockResolvedValueOnce(Response.json({ code: 'unexpected_failure' }, { status: 500 }))
    await expect(verifyProtocolUser(token)).rejects.toThrow('Auth-action protocol unavailable.')
  })
})
