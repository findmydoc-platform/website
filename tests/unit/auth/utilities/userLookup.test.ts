import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findUserBySupabaseId, isClinicUserApproved } from '@/auth/utilities/userLookup'
import { AUTH_FLOW_ERROR_CODES } from '@/auth/errors/authFlowError'
import { getUserConfig } from '@/auth/config/authConfig'
import { createMockPayload } from '../../helpers/testHelpers'
import type { Payload } from 'payload'

const accessStateMocks = vi.hoisted(() => ({
  readClinicAccessState: vi.fn(),
}))

vi.mock('@/auth/utilities/clinicAccessState', () => accessStateMocks)

const mockPayload = createMockPayload()

beforeEach(() => {
  vi.clearAllMocks()
  accessStateMocks.readClinicAccessState.mockResolvedValue(null)
})

describe('userLookup utilities', () => {
  it('looks up a clinic principal in clinicStaff and checks the other direct collections', async () => {
    const clinicPrincipal = { id: 12, supabaseUserId: 'supabase-123', collection: 'clinicStaff' }
    mockPayload.find.mockResolvedValueOnce({ docs: [clinicPrincipal] }).mockResolvedValue({ docs: [] })

    await expect(
      findUserBySupabaseId(mockPayload as unknown as Payload, {
        supabaseUserId: 'supabase-123',
        userType: 'clinic',
        userEmail: 'clinic@example.com',
      }),
    ).resolves.toEqual(clinicPrincipal)

    expect(mockPayload.find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ collection: 'clinicStaff', where: { supabaseUserId: { equals: 'supabase-123' } } }),
    )
  })

  it('fails closed when the identity also resolves in another principal collection', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [{ id: 12 }] })
      .mockResolvedValueOnce({ docs: [{ id: 13 }] })
      .mockResolvedValue({ docs: [] })

    await expect(
      findUserBySupabaseId(mockPayload as unknown as Payload, {
        supabaseUserId: 'supabase-duplicate',
        userType: 'clinic',
        userEmail: 'clinic@example.com',
      }),
    ).rejects.toMatchObject({
      code: AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED,
      message: expect.stringMatching(/more than one Payload principal/i),
      retryable: false,
    })
  })

  it('requires synced clinic staff assigned to an approved clinic', async () => {
    accessStateMocks.readClinicAccessState.mockResolvedValue({ clinic: { id: 4 }, staff: { id: 12 } })

    await expect(isClinicUserApproved(mockPayload as unknown as Payload, '12')).resolves.toBe(true)
    expect(accessStateMocks.readClinicAccessState).toHaveBeenCalledWith(mockPayload, '12', undefined)
  })

  it('maps clinic authentication directly to clinicStaff', () => {
    expect(getUserConfig('clinic')).toMatchObject({ collection: 'clinicStaff', requiresApproval: true })
  })
})
