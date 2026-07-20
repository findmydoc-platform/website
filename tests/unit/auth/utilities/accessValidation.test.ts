/**
 * Simple unit tests for access validation utilities.
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import {
  validateClinicAccess,
  validateUserTypePermissions,
  validateUserAccess,
} from '@/auth/utilities/accessValidation'
import type { Payload } from 'payload'
import type { UserResult, UserType } from '@/auth/types/authTypes'
import type { ClinicStaff as PayloadClinicStaff } from '@/payload-types'

const accessStateMocks = vi.hoisted(() => ({
  readClinicAccessState: vi.fn(),
}))

vi.mock('@/auth/utilities/clinicAccessState', () => accessStateMocks)

type ClinicUser = PayloadClinicStaff
type ClinicUserOverrides = Partial<ClinicUser> & { userType?: string }

// Mock payload
const mockPayload = {
  find: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    level: 'info',
    trace: vi.fn(),
    warn: vi.fn(),
  },
}

const makeClinicUser = (overrides: ClinicUserOverrides = {}): ClinicUser => ({
  id: overrides.id ?? 123,
  collection: 'clinicStaff',
  email: overrides.email ?? 'user@example.com',
  firstName: overrides.firstName ?? 'Test',
  lastName: overrides.lastName ?? 'User',
  stableId: overrides.stableId ?? 'clinic-user-123',
  status: overrides.status ?? 'approved',
  clinic: overrides.clinic,
  createdAt: overrides.createdAt ?? '2023-01-01',
  updatedAt: overrides.updatedAt ?? '2023-01-02',
  supabaseUserId: overrides.supabaseUserId,
  profileImage: overrides.profileImage,
})

describe('accessValidation utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    accessStateMocks.readClinicAccessState.mockResolvedValue(null)
  })

  describe('validateClinicAccess', () => {
    it('should return true for approved clinic user', async () => {
      accessStateMocks.readClinicAccessState.mockResolvedValue({ clinic: { id: 44 }, staff: { id: 123 } })

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult: UserResult = {
        user: makeClinicUser({ id: 123 }),
        collection: 'clinicStaff',
      }

      const result = await validateClinicAccess(mockPayload as unknown as Payload, authData, userResult)
      expect(result).toBe(true)
    })

    it('should return true for non-clinic users', async () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'platform' as const,
      }

      const userResult: UserResult = {
        user: makeClinicUser({ id: 123 }),
        collection: 'clinicStaff',
      }

      const result = await validateClinicAccess(mockPayload as unknown as Payload, authData, userResult)
      expect(result).toBe(true)
    })

    it('should return false for non-approved clinic user', async () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult: UserResult = {
        user: makeClinicUser({ id: 123 }),
        collection: 'clinicStaff',
      }

      const result = await validateClinicAccess(mockPayload as unknown as Payload, authData, userResult)
      expect(result).toBe(false)
    })
  })

  describe('validateUserTypePermissions', () => {
    it('should return true for valid user types', () => {
      const validTypes = ['clinic', 'platform', 'patient'] as const

      validTypes.forEach((userType) => {
        const authData = {
          supabaseUserId: 'supabase-123',
          userEmail: 'test@example.com',
          userType,
        }

        const result = validateUserTypePermissions(authData)
        expect(result).toBe(true)
      })
    })

    it('should return false for invalid user type', () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'invalid' as unknown as UserType, // Cast to bypass TypeScript for testing
      }

      const result = validateUserTypePermissions(authData)
      expect(result).toBe(false)
    })
  })

  describe('validateUserAccess', () => {
    it('should pass comprehensive validation for approved clinic user', async () => {
      accessStateMocks.readClinicAccessState.mockResolvedValue({ clinic: { id: 44 }, staff: { id: 123 } })

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult: UserResult = {
        user: makeClinicUser({ id: 123 }),
        collection: 'clinicStaff',
      }

      const result = await validateUserAccess(mockPayload as unknown as Payload, authData, userResult)
      expect(result).toBe(true)
    })

    it('should fail validation for invalid user type', async () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'invalid' as unknown as UserType, // Cast to bypass TypeScript for testing
      }

      const userResult: UserResult = {
        user: makeClinicUser({ id: 123 }),
        collection: 'clinicStaff',
      }

      const result = await validateUserAccess(mockPayload as unknown as Payload, authData, userResult)
      expect(result).toBe(false)
    })
  })
})
