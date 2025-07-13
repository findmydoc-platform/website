/**
 * Simple unit tests for user lookup utilities.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  findUserBySupabaseId,
  isClinicUserApproved,
  getUserConfig,
} from '@/auth/utilities/userLookup'

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
        profile: 'clinicStaff',
        label: 'Clinic User',
      })
    })

    it('should return config for patient user', () => {
      const result = getUserConfig('patient')
      expect(result).toEqual({
        collection: 'patients',
        profile: null,
        label: 'Patient',
      })
    })

    it('should throw error for invalid user type', () => {
      expect(() => {
        // @ts-ignore - intentionally invalid type for test
        getUserConfig('invalid')
      }).toThrow('Unknown user type: invalid')
    })
  })
})
