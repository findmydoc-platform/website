import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clinicDashboardBootstrapGetHandler } from '@/endpoints/clinicDashboardBootstrap'
import { AUTH_FLOW_ERROR_CODES, AuthFlowError } from '@/auth/errors/authFlowError'
import { CLINIC_DASHBOARD_CAPABILITIES } from '@/features/clinicDashboard/bootstrap'
import { createMockPayload, createMockReq, type MockPayload } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

const mocks = vi.hoisted(() => ({
  findUserBySupabaseId: vi.fn(),
  readClinicAccessState: vi.fn(),
  validateSupabaseBearerToken: vi.fn(),
}))

vi.mock('@/auth/utilities/jwtValidation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/auth/utilities/jwtValidation')>()),
  validateSupabaseBearerToken: mocks.validateSupabaseBearerToken,
}))

vi.mock('@/auth/utilities/userLookup', () => ({
  findUserBySupabaseId: mocks.findUserBySupabaseId,
}))

vi.mock('@/auth/utilities/clinicAccessState', () => ({
  readClinicAccessState: mocks.readClinicAccessState,
}))

const bearerHeaders = new Headers({ Authorization: 'Bearer clinic-token' })

const staffDocument = {
  id: 22,
  collection: 'clinicStaff' as const,
  stableId: 'staff-stable-id',
  supabaseUserId: 'supabase-secret-id',
  email: 'clinic@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  clinic: 8,
  status: 'approved' as const,
  authSync: { status: 'synced' as const },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const clinicDocument = {
  id: 8,
  name: 'Berlin Clinic',
  status: 'approved' as const,
  stableId: 'clinic-stable-id',
  internalNotes: 'must not leak',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const arrangeCurrentDocuments = () => {
  mocks.readClinicAccessState.mockResolvedValue({ clinic: clinicDocument, staff: staffDocument })
}

const arrangeDeniedAccess = (payload: MockPayload, staff: Record<string, unknown> | null = staffDocument) => {
  mocks.readClinicAccessState.mockResolvedValue(null)
  payload.find.mockResolvedValue({ docs: staff ? [staff] : [] })
}

const request = (
  payload: MockPayload,
  user:
    | ReturnType<typeof mockUsers.clinic>
    | ReturnType<typeof mockUsers.platform>
    | ReturnType<typeof mockUsers.patient>
    | null,
  overrides: Record<string, unknown> = {},
) =>
  createMockReq(user, payload, {
    headers: bearerHeaders,
    ...overrides,
  })

const readResponse = async (response: Response) => ({
  body: await response.json(),
  status: response.status,
})

const expectPrivateLiveHeaders = (response: Response) => {
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
  expect(response.headers.get('expires')).toBe('0')
  expect(response.headers.get('vary')).toBe('Authorization')
}

describe('Clinic Dashboard bootstrap endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.validateSupabaseBearerToken.mockResolvedValue({ status: 'invalid' })
    mocks.findUserBySupabaseId.mockResolvedValue(null)
    mocks.readClinicAccessState.mockResolvedValue(null)
  })

  it('returns only the safe, stable DTO for an approved clinic principal', async () => {
    const payload = createMockPayload()
    arrangeCurrentDocuments()

    const response = await clinicDashboardBootstrapGetHandler(request(payload, mockUsers.clinic(22, 8)))

    expect(await readResponse(response)).toEqual({
      status: 200,
      body: {
        principal: {
          id: '22',
          displayName: 'Ada Lovelace',
          email: 'clinic@example.com',
        },
        clinic: {
          id: '8',
          name: 'Berlin Clinic',
        },
        status: 'approved',
        capabilities: [...CLINIC_DASHBOARD_CAPABILITIES],
      },
    })
    expectPrivateLiveHeaders(response)
    expect(mocks.validateSupabaseBearerToken).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('rejects cookie-only authentication before trusting the resolved principal', async () => {
    const payload = createMockPayload()
    arrangeCurrentDocuments()
    const req = request(payload, mockUsers.clinic(22, 8), { headers: new Headers() })

    const response = await clinicDashboardBootstrapGetHandler(req)

    expect(await readResponse(response)).toEqual({
      status: 401,
      body: { error: { code: 'CLINIC_DASHBOARD_UNAUTHORIZED' } },
    })
    expect(payload.find).not.toHaveBeenCalled()
    expectPrivateLiveHeaders(response)
  })

  it.each([
    ['platform', mockUsers.platform()],
    ['patient', mockUsers.patient()],
  ])('rejects a resolved %s principal', async (_label, user) => {
    const payload = createMockPayload()

    const response = await clinicDashboardBootstrapGetHandler(request(payload, user))

    expect(response.status).toBe(401)
    expect(payload.find).not.toHaveBeenCalled()
    expectPrivateLiveHeaders(response)
  })

  it('returns 401 for an invalid Bearer token', async () => {
    const payload = createMockPayload()

    const response = await clinicDashboardBootstrapGetHandler(request(payload, null))

    expect(response.status).toBe(401)
    expect(mocks.findUserBySupabaseId).not.toHaveBeenCalled()
    expectPrivateLiveHeaders(response)
  })

  it('returns 401 without creating staff when the valid identity has no principal', async () => {
    const payload = createMockPayload()
    mocks.validateSupabaseBearerToken.mockResolvedValue({
      status: 'authenticated',
      authData: {
        supabaseUserId: 'missing-staff',
        userEmail: 'missing@example.com',
        userType: 'clinic',
      },
    })

    const response = await clinicDashboardBootstrapGetHandler(request(payload, null))

    expect(response.status).toBe(401)
    expect(payload.create).not.toHaveBeenCalled()
    expectPrivateLiveHeaders(response)
  })

  it('uses the focused fallback resolver when the global strategy yields no principal', async () => {
    const payload = createMockPayload()
    arrangeCurrentDocuments()
    mocks.validateSupabaseBearerToken.mockResolvedValue({
      status: 'authenticated',
      authData: {
        supabaseUserId: 'clinic-user',
        userEmail: 'clinic@example.com',
        userType: 'clinic',
      },
    })
    mocks.findUserBySupabaseId.mockResolvedValue(staffDocument)

    const response = await clinicDashboardBootstrapGetHandler(request(payload, null))

    expect(response.status).toBe(200)
    expect(mocks.findUserBySupabaseId).toHaveBeenCalledOnce()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('returns 403 when the centralized access state denies an existing staff principal', async () => {
    const payload = createMockPayload()
    arrangeDeniedAccess(payload)

    const response = await clinicDashboardBootstrapGetHandler(request(payload, mockUsers.clinic(22, 8)))

    expect(await readResponse(response)).toEqual({
      status: 403,
      body: { error: { code: 'CLINIC_DASHBOARD_ACCESS_DENIED' } },
    })
    expect(payload.find).toHaveBeenCalledOnce()
    expectPrivateLiveHeaders(response)
  })

  it('returns 401 when neither an access state nor current staff exists', async () => {
    const payload = createMockPayload()
    arrangeDeniedAccess(payload, null)

    const response = await clinicDashboardBootstrapGetHandler(request(payload, mockUsers.clinic(22, 8)))

    expect(response.status).toBe(401)
    expectPrivateLiveHeaders(response)
  })

  it('maps temporary Supabase and Payload failures to 503', async () => {
    const supabasePayload = createMockPayload()
    mocks.validateSupabaseBearerToken.mockResolvedValueOnce({ status: 'unavailable' })

    const supabaseResponse = await clinicDashboardBootstrapGetHandler(request(supabasePayload, null))
    expect(await readResponse(supabaseResponse)).toEqual({
      status: 503,
      body: { error: { code: 'CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE' } },
    })
    expectPrivateLiveHeaders(supabaseResponse)

    const databasePayload = createMockPayload()
    mocks.readClinicAccessState.mockRejectedValue(new Error('database-secret-detail'))
    const databaseResponse = await clinicDashboardBootstrapGetHandler(request(databasePayload, mockUsers.clinic(22, 8)))
    expect(await readResponse(databaseResponse)).toEqual({
      status: 503,
      body: { error: { code: 'CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE' } },
    })
    expectPrivateLiveHeaders(databaseResponse)
  })

  it('maps a conflicting Payload principal resolution to 401', async () => {
    const payload = createMockPayload()
    mocks.validateSupabaseBearerToken.mockResolvedValue({
      status: 'authenticated',
      authData: {
        supabaseUserId: 'conflicting-user',
        userEmail: 'conflict@example.com',
        userType: 'clinic',
      },
    })
    mocks.findUserBySupabaseId.mockRejectedValue(
      new AuthFlowError({
        code: AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED,
        message: 'Supabase identity resolves to more than one Payload principal',
      }),
    )

    const response = await clinicDashboardBootstrapGetHandler(request(payload, null))

    expect(await readResponse(response)).toEqual({
      status: 401,
      body: { error: { code: 'CLINIC_DASHBOARD_UNAUTHORIZED' } },
    })
    expect(payload.create).not.toHaveBeenCalled()
    expectPrivateLiveHeaders(response)
  })

  it('maps a temporary principal lookup failure to 503', async () => {
    const payload = createMockPayload()
    mocks.validateSupabaseBearerToken.mockResolvedValue({
      status: 'authenticated',
      authData: {
        supabaseUserId: 'clinic-user',
        userEmail: 'clinic@example.com',
        userType: 'clinic',
      },
    })
    mocks.findUserBySupabaseId.mockRejectedValue(
      new AuthFlowError({
        code: AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED,
        message: 'Payload lookup temporarily failed',
        retryable: true,
      }),
    )

    const response = await clinicDashboardBootstrapGetHandler(request(payload, null))

    expect(await readResponse(response)).toEqual({
      status: 503,
      body: { error: { code: 'CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE' } },
    })
    expectPrivateLiveHeaders(response)
  })

  it('derives the tenant from current Payload state and ignores client-supplied actors', async () => {
    const payload = createMockPayload()
    arrangeCurrentDocuments()
    const req = request(payload, mockUsers.clinic(22, 8), {
      body: { actor: 999, clinic: 999 },
      query: { actor: 999, clinic: 999 },
    })

    const response = await clinicDashboardBootstrapGetHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.readClinicAccessState).toHaveBeenCalledWith(payload, 22, req)
  })

  it('keeps two clinic principals isolated through fresh server-side assignments', async () => {
    const payload = createMockPayload()
    const staffById = new Map([
      [22, staffDocument],
      [23, { ...staffDocument, id: 23, clinic: 9, email: 'second@example.com' }],
    ])
    const clinicById = new Map([
      [8, clinicDocument],
      [9, { ...clinicDocument, id: 9, name: 'Hamburg Clinic' }],
    ])
    mocks.readClinicAccessState.mockImplementation(async (_payload: unknown, id: number) => {
      const staff = staffById.get(Number(id))
      const clinic = staff ? clinicById.get(Number(staff.clinic)) : undefined
      return staff && clinic ? { clinic, staff } : null
    })

    const first = await clinicDashboardBootstrapGetHandler(request(payload, mockUsers.clinic(22, 8)))
    const second = await clinicDashboardBootstrapGetHandler(request(payload, mockUsers.clinic(23, 9)))

    expect((await first.json()).clinic).toEqual({ id: '8', name: 'Berlin Clinic' })
    expect((await second.json()).clinic).toEqual({ id: '9', name: 'Hamburg Clinic' })
  })
})
