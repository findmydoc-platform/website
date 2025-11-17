import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hydrateSessionFromHash } from '@/auth/utilities/hydrateSessionFromHash'

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
  })

  it('does not set session when tokens are incomplete', async () => {
    const supabase = createSupabaseMock()

    // only access_token present
    global.window.location.hash = '#access_token=access123'

    await hydrateSessionFromHash(supabase)

    expect(supabase.auth.setSession).not.toHaveBeenCalled()
  })
})
