/**
 * Simple unit tests for user creation utilities.
 */

import { describe, it, expect, vi } from 'vitest'
import { prepareUserData, createUser } from '@/auth/utilities/userCreation'

// Mock payload
const mockPayload = {
  create: vi.fn(),
}

describe('userCreation utilities', () => {
  describe('prepareUserData', () => {
    it('should prepare data for basicUsers collection', () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
        firstName: 'John',
        lastName: 'Doe',
      }

      const config = {
        collection: 'basicUsers',
        profile: 'clinicStaff',
        label: 'Clinic User',
      }

      const result = prepareUserData(authData, config)

      expect(result).toEqual({
        supabaseUserId: 'supabase-123',
        email: 'test@example.com',
        userType: 'clinic',
      })
    })

    it('should prepare data for patients collection', () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'patient' as const,
        firstName: 'Jane',
        lastName: 'Smith',
      }

      const config = {
        collection: 'patients',
        profile: null,
        label: 'Patient',
      }

      const result = prepareUserData(authData, config)

      expect(result).toEqual({
        supabaseUserId: 'supabase-123',
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      })
    })

    it('should handle missing patient names', () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'patient' as const,
      }

      const config = {
        collection: 'patients',
        profile: null,
        label: 'Patient',
      }

      const result = prepareUserData(authData, config)

      expect(result.firstName).toBe('Unknown')
      expect(result.lastName).toBe('User')
    })
  })

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const mockCreatedUser = { id: 'user-123', email: 'test@example.com' }
      mockPayload.create.mockResolvedValue(mockCreatedUser)

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const config = {
        collection: 'basicUsers',
        profile: 'clinicStaff',
        label: 'Clinic User',
      }

      const result = await createUser(mockPayload, authData, config, {})
      expect(result).toEqual(mockCreatedUser)
    })

    it('should handle creation errors', async () => {
      mockPayload.create.mockRejectedValue(new Error('Creation failed'))

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const config = {
        collection: 'basicUsers',
        profile: 'clinicStaff',
        label: 'Clinic User',
      }

      await expect(createUser(mockPayload, authData, config, {})).rejects.toThrow(
        'User creation failed: Creation failed',
      )
    })
  })
})
