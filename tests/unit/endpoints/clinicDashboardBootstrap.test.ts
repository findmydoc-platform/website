import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clinicDashboardBootstrapGetHandler } from '@/endpoints/clinicDashboardBootstrap'
import { clinicDashboardReportingGetHandler } from '@/endpoints/clinicDashboardReporting'
import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'
import { AUTH_FLOW_ERROR_CODES, AuthFlowError } from '@/auth/errors/authFlowError'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

const mocks = vi.hoisted(() => ({ validate: vi.fn(), lookup: vi.fn() }))
vi.mock('@/auth/utilities/userLookup', () => ({ findUserBySupabaseId: mocks.lookup }))
vi.mock('@/auth/utilities/jwtValidation', async (original) => ({
  ...(await original<typeof import('@/auth/utilities/jwtValidation')>()),
  validateSupabaseBearerToken: mocks.validate,
}))
vi.mock('@/features/clinicDashboard/reporting/posthog', () => ({
  readPostHogClinicDashboardReporting: vi.fn().mockRejectedValue(new Error('analytics unavailable')),
}))

const staff = {
  id: 22,
  collection: 'clinicStaff' as const,
  email: 'staff@example.invalid',
  firstName: 'Ada',
  lastName: 'Lovelace',
  supabaseUserId: 'subject-22',
  status: 'approved',
  authSync: { status: 'synced' },
  assignmentScope: 'group',
  group: 4,
  clinic: null,
  activationReadiness: {
    version: 'identity-v1',
    principalId: '22',
    subject: 'subject-22',
    establishedAt: '2026-01-01T00:00:00Z',
  },
}

const clinic = (id: number, name: string) => ({ id, name, group: 4, participationStatus: 'approved' })
const request = (clinics = [clinic(9, 'Zeta'), clinic(8, 'Alpha'), clinic(7, 'Alpha')], clinicId?: string) => {
  const payload = createMockPayload()
  payload.find.mockImplementation(async ({ collection }: { collection: string }) => ({
    docs: collection === 'clinicStaff' ? [staff] : clinics,
    hasNextPage: false,
  }))
  payload.findByID.mockResolvedValue({ id: 4 })
  return createMockReq(staff, payload, {
    routeParams: clinicId ? { clinicId } : {},
    searchParams: new URLSearchParams('periodDays=7'),
    headers: new Headers({
      Authorization: 'Bearer personal-token',
      'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1',
    }),
  })
}

describe('clinic-scope-v1 person bootstrap', () => {
  beforeEach(() =>
    mocks.validate.mockResolvedValue({
      status: 'authenticated',
      authData: { userType: 'clinic', supabaseUserId: 'subject-22' },
    }),
  )

  it('projects the current person and name/ID-sorted authorized clinics with closed capabilities', async () => {
    const response = await clinicDashboardBootstrapGetHandler(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      schemaVersion: 'clinic-scope-v1',
      principal: { id: '22', displayName: 'Ada Lovelace', email: 'staff@example.invalid' },
      status: 'approved',
      clinics: [
        {
          id: '7',
          name: 'Alpha',
          capabilities: [
            'clinic-profile:view',
            'clinic-profile:edit',
            'clinic-treatments:view',
            'clinic-treatments:edit',
            'clinic-gallery:view',
            'clinic-gallery:edit',
            'clinic-inquiries:view',
            'clinic-inquiries:edit',
          ],
        },
        {
          id: '8',
          name: 'Alpha',
          capabilities: [
            'clinic-profile:view',
            'clinic-profile:edit',
            'clinic-treatments:view',
            'clinic-treatments:edit',
            'clinic-gallery:view',
            'clinic-gallery:edit',
            'clinic-inquiries:view',
            'clinic-inquiries:edit',
          ],
        },
        {
          id: '9',
          name: 'Zeta',
          capabilities: [
            'clinic-profile:view',
            'clinic-profile:edit',
            'clinic-treatments:view',
            'clinic-treatments:edit',
            'clinic-gallery:view',
            'clinic-gallery:edit',
            'clinic-inquiries:view',
            'clinic-inquiries:edit',
          ],
        },
      ],
    })
  })

  it('retains approved person identity with no currently authorized clinics', async () => {
    const response = await clinicDashboardBootstrapGetHandler(request([]))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ schemaVersion: 'clinic-scope-v1', status: 'approved', clinics: [] })
  })

  it('keeps legacy domain authorization closed even for a group with just one eligible clinic', async () => {
    const req = request([clinic(8, 'Alpha')])
    await expect(revalidateClinicDashboardRequest(req, 'legacy')).resolves.toEqual({ status: 'access-denied' })
  })

  it('resolves a missing request principal through the existing identity lookup without creating an account', async () => {
    const req = request()
    req.user = null
    mocks.lookup.mockResolvedValueOnce(staff)
    expect((await clinicDashboardBootstrapGetHandler(req)).status).toBe(200)
    expect(req.payload.create).not.toHaveBeenCalled()
  })

  it.each([
    [false, 401],
    [true, 503],
  ])('maps lookup errors with retryable=%s to %s', async (retryable, status) => {
    const req = request()
    req.user = null
    mocks.lookup.mockRejectedValueOnce(
      new AuthFlowError({
        code: AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED,
        message: 'Private lookup detail',
        retryable,
      }),
    )
    const response = await clinicDashboardBootstrapGetHandler(req)
    expect(response.status).toBe(status)
    expect(JSON.stringify(await response.json())).not.toContain('Private lookup detail')
  })

  it('rejects cookie-only authentication before reading assignment state', async () => {
    const req = request()
    req.headers.delete('Authorization')
    expect((await clinicDashboardBootstrapGetHandler(req)).status).toBe(401)
    expect(req.payload.find).not.toHaveBeenCalled()
  })

  it('reads reporting for the explicit authorized target rather than the first clinic', async () => {
    const req = request(undefined, '8')
    vi.mocked(req.payload.find).mockImplementation(async (args) => {
      if (args.collection === 'clinicStaff') return { docs: [staff] } as never
      if (args.collection === 'clinics') {
        if (args.select) return { docs: [{ ...clinic(8, 'Alpha'), address: { country: { isoCode: 'TR' } } }] } as never
        return { docs: [clinic(9, 'Zeta'), clinic(8, 'Alpha')] } as never
      }
      expect(JSON.stringify(args.where)).toContain('"clinic":{"equals":"8"}')
      return { docs: [], hasNextPage: false } as never
    })
    const response = await clinicDashboardReportingGetHandler(req)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      schemaVersion: 'clinic-dashboard-reporting-v1',
      metrics: { inquiries: { current: { value: 0 } } },
    })
  })

  it.each(['99', '8'])('denies reporting target %s after current authorization excludes it', async (target) => {
    const req = request([clinic(9, 'Zeta')], target)
    const response = await clinicDashboardReportingGetHandler(req)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: { code: 'CLINIC_DASHBOARD_ACCESS_DENIED', message: 'Reporting access is not available.' },
    })
    expect(
      vi
        .mocked(req.payload.find)
        .mock.calls.every(([args]) => args.collection === 'clinicStaff' || args.collection === 'clinics'),
    ).toBe(true)
  })

  it.each([undefined, 'future-scope', 'clinic-scope-v1, clinic-scope-v1'])(
    'rejects unsupported scope negotiation %s',
    async (value) => {
      const req = request()
      if (value === undefined) req.headers.delete('X-Findmydoc-Clinic-Scope-Contract')
      else req.headers.set('X-Findmydoc-Clinic-Scope-Contract', value)
      const response = await clinicDashboardBootstrapGetHandler(req)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: { code: 'CLINIC_DASHBOARD_INVALID_CONTRACT' } })
    },
  )

  it.each(['inquiry-communication-v1', 'inquiry-communication-v2'])(
    'keeps independent domain negotiation %s',
    async (version) => {
      const req = request()
      req.headers.set('X-Findmydoc-Clinic-Dashboard-Contract', version)
      expect((await clinicDashboardBootstrapGetHandler(req)).status).toBe(200)
    },
  )

  it.each([
    ['invalid', { status: 'invalid' }, 401],
    ['unavailable', { status: 'unavailable' }, 503],
    ['other subject', { status: 'authenticated', authData: { userType: 'clinic', supabaseUserId: 'other' } }, 401],
    ['other role', { status: 'authenticated', authData: { userType: 'patient', supabaseUserId: 'subject-22' } }, 401],
  ])('rejects %s Bearer even with a resolved clinic principal', async (_, validation, status) => {
    mocks.validate.mockResolvedValueOnce(validation)
    const req = request()
    const response = await clinicDashboardBootstrapGetHandler(req)
    expect(response.status).toBe(status)
    expect(req.payload.find).not.toHaveBeenCalled()
  })

  it('sanitizes source failures and keeps every response private and request-bound', async () => {
    const req = request()
    vi.mocked(req.payload.find).mockRejectedValue(new Error('database-private-detail'))
    const response = await clinicDashboardBootstrapGetHandler(req)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE' } })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(response.headers.get('expires')).toBe('0')
    expect(response.headers.get('vary')).toBe(
      'Authorization, X-Findmydoc-Clinic-Dashboard-Contract, X-Findmydoc-Clinic-Scope-Contract',
    )
  })
})
