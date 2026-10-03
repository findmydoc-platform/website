import { afterEach, expect, test, vi } from 'vitest'
import { signOutRecoverySession } from '@/auth/utilities/supaBaseServer'

const cookieSet = vi.hoisted(() => vi.fn())
vi.mock('next/headers.js', () => ({ cookies: async () => ({ set: cookieSet, getAll: () => [] }) }))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

test('retries real SDK global logout after provider failure without deleting local session cookies', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'offline-publishable-key')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'offline-service-role-key') // pragma: allowlist secret
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ msg: 'offline-unavailable' }), { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  expect((await signOutRecoverySession('offline-access-token')).error?.status).toBe(503)
  expect((await signOutRecoverySession('offline-access-token')).error).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(2)
  for (const [url, options] of fetch.mock.calls) {
    expect(String(url)).toBe('https://example.supabase.co/auth/v1/logout?scope=global')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer offline-access-token')
  }
  expect(cookieSet).not.toHaveBeenCalled()
})
