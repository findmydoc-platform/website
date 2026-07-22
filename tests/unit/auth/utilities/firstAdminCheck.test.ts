import { describe, expect, it, vi } from 'vitest'
import { getLocalPlatformStaffUserState } from '@/auth/utilities/firstAdminCheck'
import type { Payload } from 'payload'

const makePayload = (docs: unknown[]) =>
  ({
    find: vi.fn().mockResolvedValue({ docs }),
  }) as unknown as Pick<Payload, 'find'>

describe('getLocalPlatformStaffUserState', () => {
  it('reports no platform staff when no direct principal exists', async () => {
    await expect(getLocalPlatformStaffUserState(makePayload([]))).resolves.toEqual({ status: 'no_platform_staff' })
  })

  it('reports a login-capable direct platform admin', async () => {
    await expect(
      getLocalPlatformStaffUserState(
        makePayload([{ id: 1, role: 'admin', supabaseUserId: 'supabase-platform-admin' }]),
      ),
    ).resolves.toEqual({ hasPlatformAdmin: true, status: 'has_platform_staff' })
  })

  it('does not treat an unbound seeded actor as login-capable', async () => {
    await expect(
      getLocalPlatformStaffUserState(makePayload([{ id: 1, role: 'support', supabaseUserId: null }])),
    ).resolves.toEqual({
      hasPlatformAdmin: false,
      status: 'no_login_capable_platform_staff',
    })
  })
})
