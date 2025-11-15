/**
 * Simple unit tests for user lookup utilities.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  findUserBySupabaseId,
  isClinicUserApproved,
} from '@/auth/utilities/userLookup'
import { getUserConfig } from '@/auth/config/authConfig'

// Mock payload
const mockPayload = {
  find: vi.fn(),
}

describe('userLookup utilities', () => {
  describe('findUserBySupabaseId', () => {
    it('should find existing user', async () => {
      const mockUser = { id: 'user-123', supabaseUserId: 'supabase-123' }
      mockPayload.find.mockResolvedValue({
        docs: [mockUser],
      })

      const authData = {
        supabaseUserId: 'supabase-123',
        userType: 'clinic' as const,
        userEmail: 'test@example.com',
      }

      const result = await findUserBySupabaseId(mockPayload, authData)
      expect(result).toEqual(mockUser)
    })

    it('should return null if user not found', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [],
      })

      const authData = {
        supabaseUserId: 'supabase-123',
        userType: 'clinic' as const,
        userEmail: 'test@example.com',
      }

      const result = await findUserBySupabaseId(mockPayload, authData)
      expect(result).toBeNull()
    })
  })

  describe('isClinicUserApproved', () => {
    it('should return true for approved clinic user', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'staff-123', status: 'approved' }],
      })

      const result = await isClinicUserApproved(mockPayload, 'user-123')
      expect(result).toBe(true)
    })

    it('should return false for non-approved clinic user', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [],
      })

      const result = await isClinicUserApproved(mockPayload, 'user-123')
      expect(result).toBe(false)
    })
  })

  describe('getUserConfig', () => {
    it('should return config for clinic user', () => {
      const result = getUserConfig('clinic')
      expect(result).toEqual({
        collection: 'basicUsers',
        profileCollection: 'clinicStaff',
        requiresProfile: true,
        requiresApproval: true,
      })
    })

    it('should return config for patient user', () => {
      const result = getUserConfig('patient')
      expect(result).toEqual({
        collection: 'patients',
        profileCollection: null,
        requiresProfile: false,
        requiresApproval: false,
      })
    })

    it('should throw error for invalid user type', () => {
      expect(() => {
        // @ts-expect-error - intentionally invalid type for test
        getUserConfig('invalid')
      }).toThrow('Invalid user type: invalid')
    })
  })
})
