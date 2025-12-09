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
        profileCollection: 'clinicStaff',
        requiresProfile: true,
        requiresApproval: true,
      }

      const result = prepareUserData(authData, config)

      expect(result).toEqual({
        supabaseUserId: 'supabase-123',
        email: 'test@example.com',
        userType: 'clinic',
        firstName: 'John',
        lastName: 'Doe',
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
        profileCollection: null,
        requiresProfile: false,
        requiresApproval: false,
      }

      const result = prepareUserData(authData, config)

      expect(result).toEqual({
        supabaseUserId: 'supabase-123',
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      })
    })

    it('should handle missing patient names with empty string fallbacks', () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'patient' as const,
      }

      const config = {
        collection: 'patients',
        profileCollection: null,
        requiresProfile: false,
        requiresApproval: false,
      }

      const result = prepareUserData(authData, config)

      expect(result.firstName).toBe('')
      expect(result.lastName).toBe('')
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
        profileCollection: 'clinicStaff',
        requiresProfile: true,
        requiresApproval: true,
      }

      const result = await createUser(mockPayload, authData, config, {})
      expect(result).toEqual(mockCreatedUser)
      // Ensure names passed through
      expect(mockPayload.create).toHaveBeenCalledWith({
        collection: 'basicUsers',
        data: {
          supabaseUserId: 'supabase-123',
          email: 'test@example.com',
          userType: 'clinic',
          firstName: '',
          lastName: '',
        },
        req: {},
        overrideAccess: true,
      })
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
        profileCollection: 'clinicStaff',
        requiresProfile: true,
        requiresApproval: true,
      }

      await expect(createUser(mockPayload, authData, config, {})).rejects.toThrow(
        'User creation failed: Creation failed',
      )
    })
  })
})
