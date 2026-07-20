import { beforeEach, describe, expect, it, vi } from 'vitest'
import { synchronizeClinicStaffAuthState, validateClinicStaffStatusTransition } from '@/hooks/clinicStaffLifecycle'
import type { ClinicStaff } from '@/payload-types'

const authMocks = vi.hoisted(() => ({
  deleteClinicSupabaseAccount: vi.fn(),
  setClinicSupabaseAccountAccess: vi.fn(),
}))

vi.mock('@/auth/utilities/supabaseProvision', () => authMocks)

const staff = (overrides: Partial<ClinicStaff> = {}): ClinicStaff => ({
  id: 4,
  collection: 'clinicStaff',
  email: 'clinic@example.com',
  clinic: 8,
  status: 'pending',
  supabaseUserId: 'supabase-4',
  authSync: { status: 'synced' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const req = () => ({
  context: {},
  payload: {
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    },
    update: vi.fn().mockResolvedValue({}),
  },
})

describe('ClinicStaff lifecycle hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.deleteClinicSupabaseAccount.mockResolvedValue(undefined)
    authMocks.setClinicSupabaseAccountAccess.mockResolvedValue(undefined)
  })

  it.each([
    ['pending', 'approved'],
    ['pending', 'rejected'],
    ['approved', 'disabled'],
    ['disabled', 'approved'],
    ['approved', 'offboarded'],
  ] as const)('allows %s -> %s', async (previousStatus, nextStatus) => {
    await expect(
      validateClinicStaffStatusTransition({
        data: { status: nextStatus },
        operation: 'update',
        originalDoc: staff({ status: previousStatus }),
      } as never),
    ).resolves.toMatchObject({ status: nextStatus })
  })

  it.each([
    ['pending', 'disabled'],
    ['approved', 'rejected'],
    ['rejected', 'approved'],
    ['offboarded', 'approved'],
  ] as const)('rejects %s -> %s', async (previousStatus, nextStatus) => {
    await expect(
      validateClinicStaffStatusTransition({
        data: { status: nextStatus },
        operation: 'update',
        originalDoc: staff({ status: previousStatus }),
      } as never),
    ).rejects.toThrow(`${previousStatus} -> ${nextStatus}`)
  })

  it.each([
    ['approved', true],
    ['disabled', false],
    ['rejected', false],
  ] as const)('synchronizes %s with enabled=%s', async (status, enabled) => {
    const request = req()

    await synchronizeClinicStaffAuthState({
      doc: staff({ status }),
      previousDoc: staff({ status: 'pending' }),
      req: request,
    } as never)

    expect(authMocks.setClinicSupabaseAccountAccess).toHaveBeenCalledWith(
      { enabled, supabaseUserId: 'supabase-4' },
      request.payload.logger,
    )
    expect(request.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { authSync: { errorCode: null, status: 'synced' } } }),
    )
  })

  it('deletes the Supabase identity when staff is offboarded', async () => {
    const request = req()

    await synchronizeClinicStaffAuthState({
      doc: staff({ status: 'offboarded' }),
      previousDoc: staff({ status: 'approved' }),
      req: request,
    } as never)

    expect(authMocks.deleteClinicSupabaseAccount).toHaveBeenCalledWith('supabase-4', request.payload.logger)
    expect(request.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { authSync: { errorCode: null, status: 'deleted' } } }),
    )
  })

  it('stores a resumable failure when a non-pending principal has no identity', async () => {
    const request = req()

    await synchronizeClinicStaffAuthState({
      doc: staff({ status: 'approved', supabaseUserId: null }),
      previousDoc: staff({ status: 'pending' }),
      req: request,
    } as never)

    expect(request.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { authSync: { errorCode: 'missing_identity', status: 'failed' } },
      }),
    )
  })

  it('retries a failed unchanged lifecycle state and skips an already synchronized one', async () => {
    const failedRequest = req()
    const failed = staff({ status: 'disabled', authSync: { status: 'failed', errorCode: 'account_update_failed' } })

    await synchronizeClinicStaffAuthState({ doc: failed, previousDoc: failed, req: failedRequest } as never)
    expect(authMocks.setClinicSupabaseAccountAccess).toHaveBeenCalledOnce()

    vi.clearAllMocks()
    const syncedRequest = req()
    const synced = staff({ status: 'disabled', authSync: { status: 'synced' } })
    await synchronizeClinicStaffAuthState({ doc: synced, previousDoc: synced, req: syncedRequest } as never)

    expect(authMocks.setClinicSupabaseAccountAccess).not.toHaveBeenCalled()
    expect(syncedRequest.payload.update).not.toHaveBeenCalled()
  })
})
