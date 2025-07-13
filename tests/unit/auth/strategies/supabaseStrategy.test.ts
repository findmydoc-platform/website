/**
 * Unit tests for Supabase authentication strategy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'

// Mock dependencies
vi.mock('@/auth/utilities/jwtValidation', () => ({
  extractSupabaseUserData: vi.fn(),
}))

vi.mock('@/auth/utilities/userLookup', () => ({
  findUserBySupabaseId: vi.fn(),
}))

vi.mock('@/auth/utilities/userCreation', () => ({
  createUser: vi.fn(),
}))

vi.mock('@/auth/utilities/accessValidation', () => ({
  validateUserAccess: vi.fn(),
}))

vi.mock('@/auth/config/authConfig', () => ({
  getUserConfig: vi.fn(),
}))

import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import { createUser } from '@/auth/utilities/userCreation'
import { validateUserAccess } from '@/auth/utilities/accessValidation'
import { getUserConfig } from '@/auth/config/authConfig'

describe('supabaseStrategy', () => {
  const mockPayload = {
    create: vi.fn(),
    find: vi.fn(),
  }

  const mockReq = {
    headers: {
      get: vi.fn(),
    },
  }

  const mockAuthData = {
    supabaseUserId: 'supabase-123',
    userEmail: 'test@example.com',
    userType: 'clinic' as const,
    firstName: 'John',
    lastName: 'Doe',
  }

  const mockUserConfig = {
    collection: 'basicUsers' as const,
    profileCollection: 'clinicStaff' as const,
    requiresProfile: true as const,
    requiresApproval: true as const,
  }

  const mockUser = {
    id: 'user-123',
    supabaseUserId: 'supabase-123',
    email: 'test@example.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticate', () => {
    it('should authenticate existing user successfully', async () => {
      // Setup mocks
      vi.mocked(extractSupabaseUserData).mockResolvedValue(mockAuthData)
      vi.mocked(getUserConfig).mockReturnValue(mockUserConfig)
      vi.mocked(findUserBySupabaseId).mockResolvedValue(mockUser)
      vi.mocked(validateUserAccess).mockResolvedValue(true)

      const result = await supabaseStrategy.authenticate({
        payload: mockPayload,
        req: mockReq,
      })

      expect(result.user).toEqual({
        collection: 'basicUsers',
        ...mockUser,
      })
    })

    it('should create new user when not found', async () => {
      // Setup mocks
      vi.mocked(extractSupabaseUserData).mockResolvedValue(mockAuthData)
      vi.mocked(getUserConfig).mockReturnValue(mockUserConfig)
      vi.mocked(findUserBySupabaseId).mockResolvedValue(null)
      vi.mocked(createUser).mockResolvedValue(mockUser)
      vi.mocked(validateUserAccess).mockResolvedValue(true)

      const result = await supabaseStrategy.authenticate({
        payload: mockPayload,
        req: mockReq,
      })

      expect(createUser).toHaveBeenCalledWith(mockPayload, mockAuthData, mockUserConfig, mockReq)
      expect(result.user).toEqual({
        collection: 'basicUsers',
        ...mockUser,
      })
    })

    it('should return null when no auth data', async () => {
      vi.mocked(extractSupabaseUserData).mockResolvedValue(null)

      const result = await supabaseStrategy.authenticate({
        payload: mockPayload,
        req: mockReq,
      })

      expect(result.user).toBeNull()
    })

    it('should return null when access validation fails', async () => {
      vi.mocked(extractSupabaseUserData).mockResolvedValue(mockAuthData)
      vi.mocked(getUserConfig).mockReturnValue(mockUserConfig)
      vi.mocked(findUserBySupabaseId).mockResolvedValue(mockUser)
      vi.mocked(validateUserAccess).mockResolvedValue(false)

      const result = await supabaseStrategy.authenticate({
        payload: mockPayload,
        req: mockReq,
      })

      expect(result.user).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(extractSupabaseUserData).mockRejectedValue(new Error('Test error'))

      const result = await supabaseStrategy.authenticate({
        payload: mockPayload,
        req: mockReq,
      })

      expect(result.user).toBeNull()
    })

    it('should handle patient user type', async () => {
      const patientAuthData = {
        ...mockAuthData,
        userType: 'patient' as const,
      }

      const patientConfig = {
        collection: 'patients' as const,
        profileCollection: null,
        requiresProfile: false as const,
        requiresApproval: false as const,
      }

      const patientUser = {
        id: 'patient-123',
        supabaseUserId: 'supabase-123',
        firstName: 'John',
        lastName: 'Doe',
      }

      vi.mocked(extractSupabaseUserData).mockResolvedValue(patientAuthData)
      vi.mocked(getUserConfig).mockReturnValue(patientConfig)
      vi.mocked(findUserBySupabaseId).mockResolvedValue(patientUser)
      vi.mocked(validateUserAccess).mockResolvedValue(true)

      const result = await supabaseStrategy.authenticate({
        payload: mockPayload,
        req: mockReq,
      })

      expect(result.user).toEqual({
        collection: 'patients',
        ...patientUser,
      })
    })

    it('should handle platform user type', async () => {
      const platformAuthData = {
        ...mockAuthData,
        userType: 'platform' as const,
      }

      const platformConfig = {
        collection: 'basicUsers' as const,
        profileCollection: 'platformStaff' as const,
        requiresProfile: true as const,
        requiresApproval: false as const,
      }

      vi.mocked(extractSupabaseUserData).mockResolvedValue(platformAuthData)
      vi.mocked(getUserConfig).mockReturnValue(platformConfig)
      vi.mocked(findUserBySupabaseId).mockResolvedValue(mockUser)
      vi.mocked(validateUserAccess).mockResolvedValue(true)

      const result = await supabaseStrategy.authenticate({
        payload: mockPayload,
        req: mockReq,
      })

      expect(result.user).toEqual({
        collection: 'basicUsers',
        ...mockUser,
      })
    })
  })

  describe('strategy configuration', () => {
    it('should have correct strategy name', () => {
      expect(supabaseStrategy.name).toBe('supabase')
    })

    it('should have authenticate function', () => {
      expect(typeof supabaseStrategy.authenticate).toBe('function')
    })
  })
})
