import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolvePasswordResetTarget } from '@/auth/utilities/passwordResetTarget'
import type { Payload } from 'payload'

const payload = {
  find: vi.fn(),
}

const arrange = ({
  clinicStaff = [],
  patients = [],
  platformStaff = [],
}: {
  clinicStaff?: Array<Record<string, unknown>>
  patients?: Array<Record<string, unknown>>
  platformStaff?: Array<Record<string, unknown>>
}) => {
  payload.find.mockImplementation(async ({ collection }: { collection: string }) => ({
    docs: { clinicStaff, patients, platformStaff }[collection as 'clinicStaff' | 'patients' | 'platformStaff'] ?? [],
  }))
}

describe('resolvePasswordResetTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the existing website reset flow when no clinic principal exists', async () => {
    arrange({})

    await expect(resolvePasswordResetTarget(payload as unknown as Payload, ' Person@Example.COM ')).resolves.toBe(
      'website',
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: 'person@example.com' } } }),
    )
    expect(payload.find).toHaveBeenCalledTimes(1)
  })

  it.each(['pending', 'approved'] as const)('routes a synced %s clinic principal to the Dashboard', async (status) => {
    arrange({
      clinicStaff: [
        { id: 4, email: 'clinic@example.com', status, supabaseUserId: 'supabase-4', authSync: { status: 'synced' } },
      ],
    })

    await expect(resolvePasswordResetTarget(payload as unknown as Payload, 'clinic@example.com')).resolves.toBe(
      'dashboard',
    )
  })

  it.each([
    ['rejected', 'synced', 'supabase-4'],
    ['disabled', 'synced', 'supabase-4'],
    ['offboarded', 'deleted', 'supabase-4'],
    ['approved', 'failed', 'supabase-4'],
    ['approved', 'synced', null],
  ])('suppresses clinic reset for status=%s, sync=%s, identity=%s', async (status, authSyncStatus, identity) => {
    arrange({
      clinicStaff: [
        {
          id: 4,
          email: 'clinic@example.com',
          status,
          supabaseUserId: identity,
          authSync: { status: authSyncStatus },
        },
      ],
    })

    await expect(resolvePasswordResetTarget(payload as unknown as Payload, 'clinic@example.com')).resolves.toBe(
      'suppress',
    )
    expect(payload.find).toHaveBeenCalledTimes(1)
  })

  it('suppresses ambiguous duplicate clinic principals', async () => {
    arrange({
      clinicStaff: [
        { id: 4, status: 'approved', supabaseUserId: 'supabase-4', authSync: { status: 'synced' } },
        { id: 5, status: 'approved', supabaseUserId: 'supabase-5', authSync: { status: 'synced' } },
      ],
    })

    await expect(resolvePasswordResetTarget(payload as unknown as Payload, 'clinic@example.com')).resolves.toBe(
      'suppress',
    )
  })

  it('suppresses a clinic reset when the email also belongs to another principal type', async () => {
    arrange({
      clinicStaff: [{ id: 4, status: 'approved', supabaseUserId: 'supabase-4', authSync: { status: 'synced' } }],
      patients: [{ id: 9 }],
    })

    await expect(resolvePasswordResetTarget(payload as unknown as Payload, 'clinic@example.com')).resolves.toBe(
      'suppress',
    )
  })
})
