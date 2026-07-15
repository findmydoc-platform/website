import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUser, prepareUserData } from '@/auth/utilities/userCreation'
import { createMockPayload } from '../../helpers/testHelpers'
import type { Payload } from 'payload'
import type { UserConfig } from '@/auth/types/authTypes'

const patientConfig: UserConfig = {
  collection: 'patients',
  profileCollection: null,
  requiresProfile: false,
  requiresApproval: false,
}

describe('userCreation utilities', () => {
  const payload = createMockPayload()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prepares patient data only', () => {
    expect(
      prepareUserData(
        {
          supabaseUserId: 'supabase-123',
          userEmail: 'patient@example.com',
          userType: 'patient',
          firstName: 'Jane',
          lastName: 'Smith',
        },
        patientConfig,
      ),
    ).toEqual({ supabaseUserId: 'supabase-123', email: 'patient@example.com', firstName: 'Jane', lastName: 'Smith' })
  })

  it('rejects staff auto-provisioning', async () => {
    const staffConfig: UserConfig = {
      collection: 'platformStaff',
      profileCollection: null,
      requiresProfile: false,
      requiresApproval: false,
    }
    expect(() =>
      prepareUserData({ supabaseUserId: 'staff', userEmail: 'staff@findmydoc.eu', userType: 'platform' }, staffConfig),
    ).toThrow(/trusted operations/i)
    await expect(
      createUser(
        payload as unknown as Payload,
        { supabaseUserId: 'staff', userEmail: 'staff@findmydoc.eu', userType: 'platform' },
        staffConfig,
        undefined,
      ),
    ).rejects.toThrow(/trusted operations/i)
  })
})
