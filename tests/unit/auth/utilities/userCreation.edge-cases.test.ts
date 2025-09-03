/**
 * Additional edge case tests for user creation utilities.
 */

import { describe, it, expect, vi } from 'vitest'
import { prepareUserData, createUser } from '@/auth/utilities/userCreation'

describe('userCreation edge cases', () => {
  describe('prepareUserData', () => {
    it('should handle platform user type correctly', () => {
      const authData = {
        supabaseUserId: 'supabase-456',
        userEmail: 'platform@example.com',
        userType: 'platform' as const,
        firstName: 'Admin',
        lastName: 'User',
      }

      const config = {
        collection: 'basicUsers' as const,
        profileCollection: 'platformStaff' as const,
        requiresProfile: true as const,
        requiresApproval: false as const,
      }

      const result = prepareUserData(authData, config)

      expect(result).toEqual({
        supabaseUserId: 'supabase-456',
        email: 'platform@example.com',
        userType: 'platform',
        firstName: 'Admin',
        lastName: 'User',
        password: '<PASSWORD>',
      })
    })

    it('should handle unknown collection type gracefully', () => {
      const authData = {
        supabaseUserId: 'supabase-789',
        userEmail: 'unknown@example.com',
        userType: 'clinic' as const,
        firstName: 'Unknown',
        lastName: 'Type',
      }

      // @ts-ignore - intentionally testing unknown collection
      const config = {
        collection: 'unknownCollection',
        profileCollection: null,
        requiresProfile: false,
        requiresApproval: false,
      }

      const result = prepareUserData(authData, config)

      // Should still include basic fields
      expect(result).toEqual({
        supabaseUserId: 'supabase-789',
        email: 'unknown@example.com',
        password: '<PASSWORD>',
      })
    })

    it('should handle empty string names for patients', () => {
      const authData = {
        supabaseUserId: 'supabase-empty',
        userEmail: 'empty@example.com',
        userType: 'patient' as const,
        firstName: '',
        lastName: '',
      }

      const config = {
        collection: 'patients' as const,
        profileCollection: null,
        requiresProfile: false as const,
        requiresApproval: false as const,
      }

      const result = prepareUserData(authData, config)

      expect(result).toEqual({
        supabaseUserId: 'supabase-empty',
        email: 'empty@example.com',
        firstName: 'Unknown',
        lastName: 'User',
        password: '<PASSWORD>',
      })
    })

    it('should handle undefined firstName/lastName for patients', () => {
      const authData = {
        supabaseUserId: 'supabase-undefined',
        userEmail: 'undefined@example.com',
        userType: 'patient' as const,
        // firstName and lastName not provided
      }

      const config = {
        collection: 'patients' as const,
        profileCollection: null,
        requiresProfile: false as const,
        requiresApproval: false as const,
      }

      const result = prepareUserData(authData, config)

      expect(result).toEqual({
        supabaseUserId: 'supabase-undefined',
        email: 'undefined@example.com',
        firstName: 'Unknown',
        lastName: 'User',
        password: '<PASSWORD>',
      })
    })
  })

  describe('createUser', () => {
    const mockPayload = {
      create: vi.fn(),
    }

    const mockReq = { user: { id: 'current-user' } }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should create patient user with proper data', async () => {
      const mockCreatedPatient = {
        id: 'patient-123',
        supabaseUserId: 'supabase-123',
        firstName: 'Jane',
        lastName: 'Doe',
      }

      mockPayload.create.mockResolvedValue(mockCreatedPatient)

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'jane@example.com',
        userType: 'patient' as const,
        firstName: 'Jane',
        lastName: 'Doe',
      }

      const config = {
        collection: 'patients' as const,
        profileCollection: null,
        requiresProfile: false as const,
        requiresApproval: false as const,
      }

      const result = await createUser(mockPayload, authData, config, mockReq)

      expect(mockPayload.create).toHaveBeenCalledWith({
        collection: 'patients',
        data: {
          supabaseUserId: 'supabase-123',
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          password: '<PASSWORD>',
        },
        req: mockReq,
        overrideAccess: true,
      })
      expect(result).toEqual(mockCreatedPatient)
    })

    it('should create platform user correctly', async () => {
      const mockCreatedUser = {
        id: 'platform-123',
        supabaseUserId: 'supabase-platform',
        userType: 'platform',
      }

      mockPayload.create.mockResolvedValue(mockCreatedUser)

      const authData = {
        supabaseUserId: 'supabase-platform',
        userEmail: 'admin@platform.com',
        userType: 'platform' as const,
        firstName: 'Admin',
        lastName: 'User',
      }

      const config = {
        collection: 'basicUsers' as const,
        profileCollection: 'platformStaff' as const,
        requiresProfile: true as const,
        requiresApproval: false as const,
      }

      const result = await createUser(mockPayload, authData, config, mockReq)

      expect(mockPayload.create).toHaveBeenCalledWith({
        collection: 'basicUsers',
        data: {
          supabaseUserId: 'supabase-platform',
          email: 'admin@platform.com',
          userType: 'platform',
          firstName: 'Admin',
          lastName: 'User',
          password: '<PASSWORD>',
        },
        req: mockReq,
        overrideAccess: true,
      })
      expect(result).toEqual(mockCreatedUser)
    })

    it('should handle database constraint errors', async () => {
      mockPayload.create.mockRejectedValue(new Error('duplicate key value violates unique constraint'))

      const authData = {
        supabaseUserId: 'duplicate-id',
        userEmail: 'duplicate@example.com',
        userType: 'clinic' as const,
      }

      const config = {
        collection: 'basicUsers' as const,
        profileCollection: 'clinicStaff' as const,
        requiresProfile: true as const,
        requiresApproval: true as const,
      }

      await expect(createUser(mockPayload, authData, config, mockReq)).rejects.toThrow(
        'User creation failed: duplicate key value violates unique constraint',
      )
    })

    it('should handle payload validation errors', async () => {
      mockPayload.create.mockRejectedValue(new Error('ValidationError: email is required'))

      const authData = {
        supabaseUserId: 'invalid-data',
        userEmail: '', // Invalid email
        userType: 'patient' as const,
      }

      const config = {
        collection: 'patients' as const,
        profileCollection: null,
        requiresProfile: false as const,
        requiresApproval: false as const,
      }

      await expect(createUser(mockPayload, authData, config, mockReq)).rejects.toThrow(
        'User creation failed: ValidationError: email is required',
      )
    })

    it('should always use overrideAccess: true', async () => {
      const mockCreatedUser = { id: 'user-123' }
      mockPayload.create.mockResolvedValue(mockCreatedUser)

      const authData = {
        supabaseUserId: 'test-id',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const config = {
        collection: 'basicUsers' as const,
        profileCollection: 'clinicStaff' as const,
        requiresProfile: true as const,
        requiresApproval: true as const,
      }

      await createUser(mockPayload, authData, config, mockReq)

      expect(mockPayload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideAccess: true,
        }),
      )
    })
  })
})
