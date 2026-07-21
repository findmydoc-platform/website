import { beforeEach, describe, expect, it, vi } from 'vitest'

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
}))

import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'

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
})
