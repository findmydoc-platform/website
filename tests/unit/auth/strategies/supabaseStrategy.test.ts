import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Forbidden, type PayloadRequest } from 'payload'

const mocks = vi.hoisted(() => ({
  extractSupabaseUserData: vi.fn(),
  findUserBySupabaseId: vi.fn(),
  validateUserAccess: vi.fn(),
  ensurePatientOnAuth: vi.fn(),
  identifyPostHogActor: vi.fn(),
  resolvePostHogActor: vi.fn(),
}))

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: mocks.extractSupabaseUserData }))
vi.mock('@/auth/utilities/userLookup', () => ({ findUserBySupabaseId: mocks.findUserBySupabaseId }))
vi.mock('@/auth/utilities/accessValidation', () => ({ validateUserAccess: mocks.validateUserAccess }))
vi.mock('@/hooks/ensurePatientOnAuth', () => ({ ensurePatientOnAuth: mocks.ensurePatientOnAuth }))
vi.mock('@/posthog/api', () => ({
  identifyPostHogActor: mocks.identifyPostHogActor,
  resolvePostHogActor: mocks.resolvePostHogActor,
  sendPostHogException: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('next/server.js', () => ({ after: vi.fn() }))

import { AUTH_FLOW_ERROR_CODES, AuthFlowError } from '@/auth/errors/authFlowError'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { payloadDatabaseAvailabilityAfterError } from '@/features/databaseAvailability'

const payload = {
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}

const request = { headers: new Headers(), method: 'GET', context: {}, payload } as never
const args = { headers: new Headers(), payload, req: request } as never

describe('supabaseStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolvePostHogActor.mockResolvedValue({ distinctId: 'test' })
    mocks.identifyPostHogActor.mockResolvedValue(undefined)
    mocks.validateUserAccess.mockResolvedValue(true)
  })

  it('authenticates an existing direct platform principal', async () => {
    const authData = {
      supabaseUserId: 'supabase-platform',
      userEmail: 'staff@findmydoc.eu',
      userType: 'platform' as const,
    }
    const principal = { id: 9, collection: 'platformStaff', role: 'admin', supabaseUserId: authData.supabaseUserId }
    mocks.extractSupabaseUserData.mockResolvedValue(authData)
    mocks.findUserBySupabaseId.mockResolvedValue(principal)

    await expect(supabaseStrategy.authenticate(args)).resolves.toEqual({ user: principal })
    expect(mocks.ensurePatientOnAuth).not.toHaveBeenCalled()
  })

  it('fails closed for a missing staff principal and does not auto-create it', async () => {
    mocks.extractSupabaseUserData.mockResolvedValue({
      supabaseUserId: 'supabase-unprovisioned',
      userEmail: 'staff@findmydoc.eu',
      userType: 'platform',
    })
    mocks.findUserBySupabaseId.mockResolvedValue(null)

    await expect(supabaseStrategy.authenticate(args)).resolves.toEqual({ user: null })
    expect(mocks.ensurePatientOnAuth).not.toHaveBeenCalled()
    expect(mocks.validateUserAccess).not.toHaveBeenCalled()
    expect(mocks.identifyPostHogActor).not.toHaveBeenCalled()
  })

  it('rejects platform identities outside the findmydoc email domain before principal lookup', async () => {
    mocks.extractSupabaseUserData.mockResolvedValue({
      supabaseUserId: 'supabase-external',
      userEmail: 'staff@example.com',
      userType: 'platform',
    })

    await expect(supabaseStrategy.authenticate(args)).resolves.toEqual({ user: null })
    expect(mocks.findUserBySupabaseId).not.toHaveBeenCalled()
    expect(mocks.validateUserAccess).not.toHaveBeenCalled()
    expect(mocks.ensurePatientOnAuth).not.toHaveBeenCalled()
  })

  it('keeps patient ensure-on-auth behavior', async () => {
    const authData = {
      supabaseUserId: 'supabase-patient',
      userEmail: 'patient@example.com',
      userType: 'patient' as const,
    }
    const principal = { id: 11, collection: 'patients', supabaseUserId: authData.supabaseUserId }
    mocks.extractSupabaseUserData.mockResolvedValue(authData)
    mocks.ensurePatientOnAuth.mockResolvedValue(principal)

    await expect(supabaseStrategy.authenticate(args)).resolves.toEqual({ user: principal })
    expect(mocks.findUserBySupabaseId).not.toHaveBeenCalled()
  })

  it.each([
    { userType: 'platform', payloadAPI: 'REST', method: 'PATCH', mapsToUnavailable: true },
    { userType: 'platform', payloadAPI: 'REST', method: 'GET', mapsToUnavailable: false },
    { userType: 'platform', payloadAPI: 'GraphQL', method: 'POST', mapsToUnavailable: false },
    { userType: 'clinic', payloadAPI: 'REST', method: 'PATCH', mapsToUnavailable: false },
  ] as const)(
    'fails closed after a principal lookup outage for $userType on $payloadAPI $method',
    async ({ userType, payloadAPI, method, mapsToUnavailable }) => {
      const req = Object.assign(new Request('https://payload-boundary.test/api/posts/1', { method }), {
        context: {},
        payload,
        payloadAPI,
        user: null,
      }) as unknown as PayloadRequest
      mocks.extractSupabaseUserData.mockResolvedValueOnce({
        supabaseUserId: 'supabase-staff',
        userEmail: 'staff@findmydoc.eu',
        userType,
      })
      mocks.findUserBySupabaseId.mockRejectedValueOnce(
        new AuthFlowError({
          code: AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED,
          message: 'Principal lookup failed',
          retryable: true,
          causeError: Object.assign(new Error('internal-test-db connection failed'), { code: 'ECONNREFUSED' }),
        }),
      )

      await expect(supabaseStrategy.authenticate({ headers: req.headers, payload, req } as never)).resolves.toEqual({
        user: null,
      })
      const denied = await payloadDatabaseAvailabilityAfterError({
        context: req.context,
        error: new Forbidden(),
        req,
      })

      if (mapsToUnavailable) {
        expect(denied).toMatchObject({
          status: 503,
          response: {
            error: { code: 'DATABASE_TEMPORARILY_UNAVAILABLE' },
            errors: [{ message: expect.stringMatching(/\S/) }],
          },
        })
        expect(JSON.stringify(denied)).not.toContain('internal-test-db')
        expect(req.responseHeaders?.get('cache-control')).toBe('private, no-store')
      } else {
        expect(denied).toBeUndefined()
      }
      expect(mocks.validateUserAccess).not.toHaveBeenCalled()
    },
  )

  it.each(['extractSupabaseUserData', 'identifyPostHogActor'] as const)(
    'preserves the permission error when %s fails with a network error',
    async (failingStep) => {
      const req = Object.assign(new Request('https://payload-boundary.test/api/posts/1', { method: 'PATCH' }), {
        context: {},
        payload,
        payloadAPI: 'REST',
        user: null,
      }) as unknown as PayloadRequest
      mocks.extractSupabaseUserData.mockResolvedValue({
        supabaseUserId: 'supabase-staff',
        userEmail: 'staff@findmydoc.eu',
        userType: 'platform',
      })
      mocks.findUserBySupabaseId.mockResolvedValue({ id: 9, role: 'admin' })
      mocks[failingStep].mockRejectedValueOnce(Object.assign(new Error('Network failed'), { code: 'ECONNREFUSED' }))

      await expect(supabaseStrategy.authenticate({ headers: req.headers, payload, req } as never)).resolves.toEqual({
        user: null,
      })
      expect(
        await payloadDatabaseAvailabilityAfterError({ context: req.context, error: new Forbidden(), req }),
      ).toBeUndefined()
    },
  )
})
