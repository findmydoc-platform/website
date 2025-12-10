/**
 * Simple unit tests for access validation utilities.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  validateClinicAccess,
  validateUserTypePermissions,
  validateUserAccess,
} from '@/auth/utilities/accessValidation'
import type { Payload } from 'payload'
import type { UserResult, UserType } from '@/auth/types/authTypes'
import type { BasicUser } from '@/payload-types'

// Mock payload
const mockPayload = {
  find: vi.fn(),
}

const makeBasicUser = (overrides: Partial<BasicUser> = {}): BasicUser => ({
  id: overrides.id ?? 123,
  email: overrides.email ?? 'user@example.com',
  firstName: overrides.firstName ?? 'Test',
  lastName: overrides.lastName ?? 'User',
  userType: overrides.userType ?? 'clinic',
  createdAt: overrides.createdAt ?? '2023-01-01',
  updatedAt: overrides.updatedAt ?? '2023-01-02',
  supabaseUserId: overrides.supabaseUserId,
  profileImage: overrides.profileImage,
})

describe('accessValidation utilities', () => {
  describe('validateClinicAccess', () => {
    it('should return true for approved clinic user', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'staff-123', status: 'approved' }],
      })

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult: UserResult = {
        user: makeBasicUser({ id: 123, userType: 'clinic' }),
        collection: 'basicUsers',
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
        user: makeBasicUser({ id: 123, userType: 'platform' }),
        collection: 'basicUsers',
      }

      const result = await validateClinicAccess(mockPayload as unknown as Payload, authData, userResult)
      expect(result).toBe(true)
    })

    it('should return false for non-approved clinic user', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [],
      })

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult: UserResult = {
        user: makeBasicUser({ id: 123, userType: 'clinic' }),
        collection: 'basicUsers',
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
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'staff-123', status: 'approved' }],
      })

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult: UserResult = {
        user: makeBasicUser({ id: 123, userType: 'clinic' }),
        collection: 'basicUsers',
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
        user: makeBasicUser({ id: 123, userType: 'clinic' }),
        collection: 'basicUsers',
      }

      const result = await validateUserAccess(mockPayload as unknown as Payload, authData, userResult)
      expect(result).toBe(false)
    })
  })
})
