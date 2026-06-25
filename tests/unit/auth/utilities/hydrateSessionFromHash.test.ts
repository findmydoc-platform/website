import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { captureSupabaseAuthHashFromUrl, hydrateSessionFromHash } from '@/auth/utilities/hydrateSessionFromHash'

function createSupabaseMock() {
  return {
    auth: {
      setSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  } as unknown as SupabaseClient
}

describe('hydrateSessionFromHash', () => {
  const originalWindow = global.window

  beforeEach(() => {
    global.window = {
      location: {
        hash: '',
        pathname: '/auth/invite/complete',
        search: '',
      },
      history: {
        replaceState: vi.fn(),
      },
    } as unknown as Window & typeof globalThis

    global.document = { title: 'Test' } as Document
  })

  afterEach(() => {
    global.window = originalWindow
    // @ts-expect-error - reset document
    global.document = undefined
    vi.restoreAllMocks()
  })

  it('does nothing when there is no hash', async () => {
    const supabase = createSupabaseMock()

    await hydrateSessionFromHash(supabase)

    expect(supabase.auth.setSession).not.toHaveBeenCalled()
  })

  it('sets session when access and refresh tokens exist in hash', async () => {
    const supabase = createSupabaseMock()

    global.window.location.hash = '#access_token=access123&refresh_token=refresh456'

    await hydrateSessionFromHash(supabase)

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'access123',
      refresh_token: 'refresh456',
    })
    expect(global.window.history.replaceState).toHaveBeenCalledWith({}, 'Test', '/auth/invite/complete')

    const cleanupCallOrder = vi.mocked(global.window.history.replaceState).mock.invocationCallOrder[0]
    const setSessionCallOrder = vi.mocked(supabase.auth.setSession).mock.invocationCallOrder[0]
    expect(cleanupCallOrder).toEqual(expect.any(Number))
    expect(setSessionCallOrder).toEqual(expect.any(Number))
    expect(cleanupCallOrder!).toBeLessThan(setSessionCallOrder!)
  })

  it('clears token hashes before surfacing setSession errors', async () => {
    const supabase = createSupabaseMock()
    vi.mocked(supabase.auth.setSession).mockRejectedValueOnce(new Error('invalid session'))

    global.window.location.hash = '#access_token=access123&refresh_token=refresh456'

    await expect(hydrateSessionFromHash(supabase)).rejects.toThrow('invalid session')

    expect(global.window.history.replaceState).toHaveBeenCalledWith({}, 'Test', '/auth/invite/complete')

    const cleanupCallOrder = vi.mocked(global.window.history.replaceState).mock.invocationCallOrder[0]
    const setSessionCallOrder = vi.mocked(supabase.auth.setSession).mock.invocationCallOrder[0]
    expect(cleanupCallOrder).toEqual(expect.any(Number))
    expect(setSessionCallOrder).toEqual(expect.any(Number))
    expect(cleanupCallOrder!).toBeLessThan(setSessionCallOrder!)
  })

  it('hydrates the session from a hash captured before telemetry can initialize', async () => {
    const supabase = createSupabaseMock()

    global.window.location.hash = '#access_token=access123&refresh_token=refresh456'

    expect(captureSupabaseAuthHashFromUrl()).toBe(true)
    expect(global.window.history.replaceState).toHaveBeenCalledWith({}, 'Test', '/auth/invite/complete')

    global.window.location.hash = ''

    await hydrateSessionFromHash(supabase)

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'access123',
      refresh_token: 'refresh456',
    })
  })

  it('clears hashes without setting a session when tokens are incomplete', async () => {
    const supabase = createSupabaseMock()

    global.window.location.hash = '#access_token=access123'

    await hydrateSessionFromHash(supabase)

    expect(supabase.auth.setSession).not.toHaveBeenCalled()
    expect(global.window.history.replaceState).toHaveBeenCalledWith({}, 'Test', '/auth/invite/complete')
  })

  it('clears Supabase error hashes without setting a session', async () => {
    const supabase = createSupabaseMock()

    global.window.location.hash =
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'

    await hydrateSessionFromHash(supabase)

    expect(supabase.auth.setSession).not.toHaveBeenCalled()
    expect(global.window.history.replaceState).toHaveBeenCalledWith({}, 'Test', '/auth/invite/complete')
  })

  it('preserves non-auth hashes', async () => {
    const supabase = createSupabaseMock()

    global.window.location.hash = '#clinic-directory'

    await hydrateSessionFromHash(supabase)

    expect(supabase.auth.setSession).not.toHaveBeenCalled()
    expect(global.window.history.replaceState).not.toHaveBeenCalled()
  })
})
