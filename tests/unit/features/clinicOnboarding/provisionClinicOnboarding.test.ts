import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  provisionClinicOnboarding,
  type ClinicOnboardingCommand,
} from '@/features/clinicOnboarding/provisionClinicOnboarding'
import type { Clinic, ClinicStaff } from '@/payload-types'
import type { Payload } from 'payload'
import { guardClinicAccountEvidence } from '@/auth/utilities/clinicAccountCompletion'

const authMocks = vi.hoisted(() => ({
  createInitialClinicSupabaseAccount: vi.fn(),
  setClinicSupabaseAccountAccess: vi.fn(),
  reconcileExistingClinicSupabaseAccount: vi.fn(),
}))

vi.mock('@/auth/utilities/supabaseProvision', () => authMocks)

const command: ClinicOnboardingCommand = {
  onboardingKey: 'clinic-application:42',
  clinicName: 'Example Clinic',
  website: 'https://clinic.example',
  contactFirstName: 'Ada',
  contactLastName: 'Lovelace',
  contactEmail: 'Clinic@Example.com',
  contactRole: 'Clinic Management',
}

const createPayload = ({ failClinicStaffCreate = false }: { failClinicStaffCreate?: boolean } = {}) => {
  const clinics: Clinic[] = []
  const clinicStaff: ClinicStaff[] = []
  const payload = {
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    },
    find: vi.fn(async ({ collection, where }: { collection: string; where: Record<string, unknown> }) => {
      const onboardingKey = (where.onboardingKey as { equals?: string } | undefined)?.equals
      const docs = collection === 'clinics' ? clinics : clinicStaff
      return { docs: docs.filter((doc) => doc.onboardingKey === onboardingKey) }
    }),
    create: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (collection === 'clinics') {
        const clinic = {
          ...data,
          id: 8 + clinics.length,
          status: 'pending',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        } as Clinic
        clinics.push(clinic)
        return clinic
      }

      if (failClinicStaffCreate) throw new Error('Clinic staff create failed')

      // Payload 3.88 create passes an empty original document and materializes group defaults.
      const normalizedData: Record<string, unknown> = {
        accountCompletion: {},
        legacyAccess: { initialParticipant: false },
        ...data,
      }
      if (data.legacyAccess && typeof data.legacyAccess === 'object' && !Array.isArray(data.legacyAccess)) {
        normalizedData.legacyAccess = { initialParticipant: false, ...data.legacyAccess }
      }
      guardClinicAccountEvidence({
        data: normalizedData,
        originalDoc: {},
        operation: 'create',
        req: { context: {} },
      } as never)

      const staff = {
        ...normalizedData,
        id: 4 + clinicStaff.length,
        collection: 'clinicStaff',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as ClinicStaff
      clinicStaff.push(staff)
      return staff
    }),
    update: vi.fn(async ({ data, id }: { data: Partial<ClinicStaff>; id: number }) => {
      const index = clinicStaff.findIndex((staff) => staff.id === id)
      clinicStaff[index] = { ...clinicStaff[index]!, ...data }
      return clinicStaff[index]
    }),
  }

  return { clinics, clinicStaff, payload: payload as unknown as Payload }
}

describe('provisionClinicOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.createInitialClinicSupabaseAccount.mockImplementation(
      async () => `supabase-${authMocks.createInitialClinicSupabaseAccount.mock.calls.length}`,
    )
    authMocks.setClinicSupabaseAccountAccess.mockResolvedValue(undefined)
  })

  it('authorizes one private clinic and its initial principal without completing the password', async () => {
    const state = createPayload()

    const result = await provisionClinicOnboarding(state.payload, command)

    expect(result).toEqual({ clinicId: 8, clinicStaffId: 4 })
    expect(state.clinics).toHaveLength(1)
    expect(state.clinicStaff).toHaveLength(1)
    expect(state.clinicStaff[0]).toMatchObject({
      email: 'clinic@example.com',
      status: 'approved',
      supabaseUserId: 'supabase-1',
      authSync: { status: 'synced' },
    })
    expect(state.clinicStaff[0]?.invitationAttemptedAt).toBeUndefined()
    expect(authMocks.createInitialClinicSupabaseAccount).toHaveBeenCalledWith(
      {
        email: 'clinic@example.com',
        onboardingKey: 'clinic-application:42',
        userMetadata: { firstName: 'Ada', lastName: 'Lovelace' },
      },
      state.payload.logger,
    )
    expect(state.payload.logger.warn).not.toHaveBeenCalled()
  })

  it('reuses the same participants and invitation after repeated approval', async () => {
    const state = createPayload()
    const first = await provisionClinicOnboarding(state.payload, command)
    const second = await provisionClinicOnboarding(state.payload, command)
    expect(first).toEqual(second)
    expect(state.clinics).toHaveLength(1)
    expect(state.clinicStaff).toHaveLength(1)
    expect(authMocks.createInitialClinicSupabaseAccount).toHaveBeenCalledOnce()
    expect(state.clinics[0]).toMatchObject({ participationStatus: 'approved', status: 'pending' })
    expect(state.clinicStaff[0]?.accountCompletion?.source).toBeUndefined()
  })

  it('reconciles an uncertain identity creation without dispatching native invitation mail', async () => {
    const state = createPayload()
    authMocks.createInitialClinicSupabaseAccount.mockRejectedValueOnce(new Error('Uncertain provider response'))
    await expect(provisionClinicOnboarding(state.payload, command)).rejects.toMatchObject({ code: 'auth_failed' })
    authMocks.reconcileExistingClinicSupabaseAccount.mockResolvedValueOnce('recovered-subject')
    await expect(provisionClinicOnboarding(state.payload, command)).resolves.toEqual({ clinicId: 8, clinicStaffId: 4 })
    expect(state.clinics).toHaveLength(1)
    expect(state.clinicStaff).toHaveLength(1)
    expect(authMocks.createInitialClinicSupabaseAccount).toHaveBeenCalledTimes(2)
  })

  it('retries a failed provider lookup without marking a native invitation attempt', async () => {
    const state = createPayload()
    authMocks.createInitialClinicSupabaseAccount.mockRejectedValueOnce(new Error('Lookup unavailable'))
    await expect(provisionClinicOnboarding(state.payload, command)).rejects.toMatchObject({ code: 'auth_failed' })
    expect(state.clinicStaff[0]?.invitationAttemptedAt).toBeUndefined()
    await expect(provisionClinicOnboarding(state.payload, command)).resolves.toEqual({ clinicId: 8, clinicStaffId: 4 })
    expect(authMocks.createInitialClinicSupabaseAccount).toHaveBeenCalledTimes(2)
    expect(authMocks.reconcileExistingClinicSupabaseAccount).not.toHaveBeenCalled()
    expect(state.clinicStaff).toHaveLength(1)
  })

  it('preserves partial records and returns a controlled auth failure', async () => {
    const state = createPayload()
    authMocks.createInitialClinicSupabaseAccount.mockRejectedValueOnce(new Error('Supabase unavailable'))

    await expect(provisionClinicOnboarding(state.payload, command)).rejects.toMatchObject({
      code: 'auth_failed',
    })
    expect(state.clinics).toHaveLength(1)
    expect(state.clinicStaff).toHaveLength(1)
    expect(state.clinicStaff[0]?.authSync).toEqual({ status: 'pending' })
  })

  it('refuses ambiguous historical records without creating or inviting participants', async () => {
    const state = createPayload()
    state.clinics.push(
      { id: 7, onboardingKey: command.onboardingKey } as Clinic,
      { id: 9, onboardingKey: command.onboardingKey } as Clinic,
    )
    await expect(provisionClinicOnboarding(state.payload, command)).rejects.toMatchObject({ code: 'record_failed' })
    expect(state.payload.create).not.toHaveBeenCalled()
    expect(authMocks.createInitialClinicSupabaseAccount).not.toHaveBeenCalled()
  })

  it('rejects invalid command input before creating records', async () => {
    const state = createPayload()

    await expect(
      provisionClinicOnboarding(state.payload, { ...command, contactEmail: 'not-an-email' }),
    ).rejects.toMatchObject({ code: 'record_failed' })
    expect(state.payload.create).not.toHaveBeenCalled()
  })
})
