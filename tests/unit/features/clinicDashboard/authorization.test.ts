import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'

const mocks = vi.hoisted(() => ({
  resolveClinicDashboardBootstrap: vi.fn(),
  validateSupabaseBearerToken: vi.fn(),
}))

vi.mock('@/auth/utilities/jwtValidation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/auth/utilities/jwtValidation')>()),
  validateSupabaseBearerToken: mocks.validateSupabaseBearerToken,
}))

vi.mock('@/features/clinicDashboard/bootstrap', () => ({
  resolveClinicDashboardBootstrap: mocks.resolveClinicDashboardBootstrap,
}))

import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'

const resolvedBootstrap = {
  data: {
    capabilities: ['clinic-profile:view'],
    clinic: { id: 'clinic-1', name: 'Synthetic Clinic' },
    principal: { displayName: 'Synthetic Staff', email: 'staff@example.invalid', id: 'staff-1' },
    status: 'approved' as const,
  },
  status: 'success' as const,
}

const cookiePrincipalRequest = (subject = 'supabase-staff-1') =>
  createMockReq({ collection: 'clinicStaff', id: 'staff-1', supabaseUserId: subject }, createMockPayload(), {
    headers: new Headers({ Authorization: 'Bearer clinic-token', Cookie: 'sb-existing-session=cookie-principal' }),
  })

describe('Clinic Dashboard Bearer revalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveClinicDashboardBootstrap.mockResolvedValue(resolvedBootstrap)
    mocks.validateSupabaseBearerToken.mockResolvedValue({
      authData: { supabaseUserId: 'supabase-staff-1', userType: 'clinic' },
      status: 'authenticated',
    })
  })

  it('does not let a cookie-populated principal bypass an invalid Bearer token', async () => {
    mocks.validateSupabaseBearerToken.mockResolvedValueOnce({ status: 'invalid' })

    const result = await revalidateClinicDashboardRequest(cookiePrincipalRequest(), 'legacy')

    expect(result).toEqual({ status: 'unauthorized' })
    expect(mocks.resolveClinicDashboardBootstrap).not.toHaveBeenCalled()
    expect(result).not.toHaveProperty('data')
  })

  it('rejects an expired-or-invalid Bearer before resolving cookie principal access', async () => {
    mocks.validateSupabaseBearerToken.mockResolvedValueOnce({ status: 'invalid' })

    const result = await revalidateClinicDashboardRequest(cookiePrincipalRequest(), 'legacy')

    expect(result).toEqual({ status: 'unauthorized' })
    expect(mocks.resolveClinicDashboardBootstrap).not.toHaveBeenCalled()
  })

  it('rejects a valid Bearer whose subject differs from the current cookie principal', async () => {
    mocks.validateSupabaseBearerToken.mockResolvedValueOnce({
      authData: { supabaseUserId: 'other-supabase-user', userType: 'clinic' },
      status: 'authenticated',
    })

    const result = await revalidateClinicDashboardRequest(cookiePrincipalRequest(), 'legacy')

    expect(result).toEqual({ status: 'unauthorized' })
    expect(mocks.resolveClinicDashboardBootstrap).toHaveBeenCalledOnce()
    expect(result).not.toHaveProperty('data')
  })

  it('allows only the validated Bearer bound to the resolved current principal', async () => {
    const req = cookiePrincipalRequest()

    await expect(revalidateClinicDashboardRequest(req, 'legacy')).resolves.toEqual({
      data: resolvedBootstrap.data,
      status: 'authorized',
    })
    expect(mocks.validateSupabaseBearerToken).toHaveBeenCalledWith(
      expect.objectContaining({ headers: req.headers, token: 'clinic-token' }),
    )
  })
})
