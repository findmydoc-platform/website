import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  provisionClinicOnboarding,
  type ClinicOnboardingCommand,
} from '@/features/clinicOnboarding/provisionClinicOnboarding'
import type { Clinic, ClinicStaff } from '@/payload-types'
import type { Payload } from 'payload'

const authMocks = vi.hoisted(() => ({
  inviteClinicSupabaseAccount: vi.fn(),
  setClinicSupabaseAccountAccess: vi.fn(),
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

      const staff = {
        ...data,
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
    authMocks.inviteClinicSupabaseAccount.mockImplementation(
      async () => `supabase-${authMocks.inviteClinicSupabaseAccount.mock.calls.length}`,
    )
    authMocks.setClinicSupabaseAccountAccess.mockResolvedValue(undefined)
  })

  it('creates and binds one pending clinic principal', async () => {
    const state = createPayload()

    const result = await provisionClinicOnboarding(state.payload, command)

    expect(result).toEqual({ clinicId: 8, clinicStaffId: 4 })
    expect(state.clinics).toHaveLength(1)
    expect(state.clinicStaff).toHaveLength(1)
    expect(state.clinicStaff[0]).toMatchObject({
      email: 'clinic@example.com',
      status: 'pending',
      supabaseUserId: 'supabase-1',
      authSync: { status: 'synced' },
    })
    expect(authMocks.inviteClinicSupabaseAccount).toHaveBeenCalledOnce()
    expect(state.payload.logger.warn).not.toHaveBeenCalled()
  })

  it('allows repeated writes and logs the resulting record ids', async () => {
    const state = createPayload()

    const first = await provisionClinicOnboarding(state.payload, command)
    const second = await provisionClinicOnboarding(state.payload, command)

    expect(first).toEqual({ clinicId: 8, clinicStaffId: 4 })
    expect(second).toEqual({ clinicId: 9, clinicStaffId: 5 })
    expect(state.clinics).toHaveLength(2)
    expect(state.clinicStaff).toHaveLength(2)
    expect(state.payload.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicIds: [8, 9],
        clinicStaffIds: [4, 5],
        event: 'clinic_onboarding.duplicate_records_detected',
      }),
      'Multiple onboarding records were created for the same source',
    )
  })

  it('preserves partial records and returns a controlled auth failure', async () => {
    const state = createPayload()
    authMocks.inviteClinicSupabaseAccount.mockRejectedValueOnce(new Error('Supabase unavailable'))

    await expect(provisionClinicOnboarding(state.payload, command)).rejects.toMatchObject({
      code: 'auth_failed',
    })
    expect(state.clinics).toHaveLength(1)
    expect(state.clinicStaff).toHaveLength(1)
    expect(state.clinicStaff[0]?.authSync).toEqual({ status: 'pending' })
  })

  it('logs duplicate clinics when clinic staff creation leaves a partial write', async () => {
    const state = createPayload({ failClinicStaffCreate: true })
    state.clinics.push({ id: 7, onboardingKey: command.onboardingKey } as Clinic)

    await expect(provisionClinicOnboarding(state.payload, command)).rejects.toMatchObject({
      code: 'record_failed',
    })

    expect(state.clinics.map(({ id }) => id)).toEqual([7, 9])
    expect(state.payload.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicIds: [7, 9],
        clinicStaffIds: [],
        event: 'clinic_onboarding.duplicate_records_detected',
      }),
      'Multiple onboarding records were created for the same source',
    )
  })

  it('rejects invalid command input before creating records', async () => {
    const state = createPayload()

    await expect(
      provisionClinicOnboarding(state.payload, { ...command, contactEmail: 'not-an-email' }),
    ).rejects.toMatchObject({ code: 'record_failed' })
    expect(state.payload.create).not.toHaveBeenCalled()
  })
})
