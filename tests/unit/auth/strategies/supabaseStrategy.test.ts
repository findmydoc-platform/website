/**
 * Unit tests for Supabase authentication strategy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import type { Payload, PayloadRequest } from 'payload'

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

vi.mock('@/hooks/ensurePatientOnAuth', () => ({
  ensurePatientOnAuth: vi.fn(),
}))

vi.mock('@/posthog', () => ({
  identifyUser: vi.fn(),
}))

import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import { createUser } from '@/auth/utilities/userCreation'
import { validateUserAccess } from '@/auth/utilities/accessValidation'
import { getUserConfig } from '@/auth/config/authConfig'
import { ensurePatientOnAuth } from '@/hooks/ensurePatientOnAuth'
import { identifyUser } from '@/posthog'

describe('supabaseStrategy', () => {
  let mockPayload: ReturnType<typeof createMockPayload>
  let payload: Payload
  let mockReq: PayloadRequest

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
    id: 123,
    supabaseUserId: 'supabase-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    userType: 'clinic' as const,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPayload = createMockPayload()
    payload = mockPayload as unknown as Payload
    mockReq = createMockReq(undefined, mockPayload)
  })

  describe('authenticate', () => {
    const buildArgs = (overrides: Record<string, unknown> = {}) =>
      ({ payload, headers: new Headers(), req: mockReq, ...overrides }) as unknown as Parameters<
        typeof supabaseStrategy.authenticate
      >[0]

    const buildArgsWithoutReq = (overrides: Record<string, unknown> = {}) =>
      ({ payload, headers: new Headers(), ...overrides }) as unknown as Parameters<
        typeof supabaseStrategy.authenticate
      >[0]

    it('should authenticate existing user successfully', async () => {
      // Setup mocks
      vi.mocked(extractSupabaseUserData).mockResolvedValue(mockAuthData)
      vi.mocked(getUserConfig).mockReturnValue(mockUserConfig)
      vi.mocked(findUserBySupabaseId).mockResolvedValue(mockUser)
      vi.mocked(validateUserAccess).mockResolvedValue(true)

      const result = await supabaseStrategy.authenticate(buildArgs())

      expect(identifyUser).toHaveBeenCalledWith(mockAuthData)
      expect(result.user).toEqual({
        collection: 'basicUsers',
        ...mockUser,
      })
    })

    it('should authenticate even when req is missing (session/cookie fallback)', async () => {
      vi.mocked(extractSupabaseUserData).mockResolvedValue(mockAuthData)
      vi.mocked(getUserConfig).mockReturnValue(mockUserConfig)
      vi.mocked(findUserBySupabaseId).mockResolvedValue(mockUser)
      vi.mocked(validateUserAccess).mockResolvedValue(true)

      const result = await supabaseStrategy.authenticate(buildArgsWithoutReq())

      expect(extractSupabaseUserData).toHaveBeenCalledWith(undefined)
      expect(identifyUser).toHaveBeenCalledWith(mockAuthData)
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

      const result = await supabaseStrategy.authenticate(buildArgs())

      expect(createUser).toHaveBeenCalledWith(mockPayload, mockAuthData, mockUserConfig, mockReq)
      expect(identifyUser).toHaveBeenCalledWith(mockAuthData)
      expect(result.user).toEqual({
        collection: 'basicUsers',
        ...mockUser,
      })
    })

    it('should create new user when req is missing (session/cookie fallback)', async () => {
      vi.mocked(extractSupabaseUserData).mockResolvedValue(mockAuthData)
      vi.mocked(getUserConfig).mockReturnValue(mockUserConfig)
      vi.mocked(findUserBySupabaseId).mockResolvedValue(null)
      vi.mocked(createUser).mockResolvedValue(mockUser)
      vi.mocked(validateUserAccess).mockResolvedValue(true)

      const result = await supabaseStrategy.authenticate(buildArgsWithoutReq())

      expect(createUser).toHaveBeenCalledWith(mockPayload, mockAuthData, mockUserConfig, undefined)
      expect(identifyUser).toHaveBeenCalledWith(mockAuthData)
      expect(result.user).toEqual({
        collection: 'basicUsers',
        ...mockUser,
      })
    })

    it('should return null when no auth data', async () => {
      vi.mocked(extractSupabaseUserData).mockResolvedValue(null)

      const result = await supabaseStrategy.authenticate(buildArgs())

      expect(result.user).toBeNull()
    })

    it('should return null when access validation fails', async () => {
      vi.mocked(extractSupabaseUserData).mockResolvedValue(mockAuthData)
      vi.mocked(getUserConfig).mockReturnValue(mockUserConfig)
      vi.mocked(findUserBySupabaseId).mockResolvedValue(mockUser)
      vi.mocked(validateUserAccess).mockResolvedValue(false)

      const result = await supabaseStrategy.authenticate(buildArgs())

      expect(result.user).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(extractSupabaseUserData).mockRejectedValue(new Error('Test error'))

      const result = await supabaseStrategy.authenticate(buildArgs())

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
        id: 456,
        supabaseUserId: 'supabase-123',
        email: 'patient@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      }

      vi.mocked(extractSupabaseUserData).mockResolvedValue(patientAuthData)
      vi.mocked(getUserConfig).mockReturnValue(patientConfig)
      vi.mocked(ensurePatientOnAuth).mockResolvedValue(patientUser)
      vi.mocked(validateUserAccess).mockResolvedValue(true)

      const result = await supabaseStrategy.authenticate(buildArgs())

      expect(ensurePatientOnAuth).toHaveBeenCalledWith({
        payload: mockPayload,
        authData: patientAuthData,
        req: mockReq,
      })
      expect(identifyUser).toHaveBeenCalledWith(patientAuthData)
      expect(result.user).toEqual({
        collection: 'patients',
        ...patientUser,
      })
    })

    it('should handle patient user type when req is missing', async () => {
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
        id: 789,
        supabaseUserId: 'supabase-123',
        email: 'patient@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      }

      vi.mocked(extractSupabaseUserData).mockResolvedValue(patientAuthData)
      vi.mocked(getUserConfig).mockReturnValue(patientConfig)
      vi.mocked(ensurePatientOnAuth).mockResolvedValue(patientUser)
      vi.mocked(validateUserAccess).mockResolvedValue(true)

      const result = await supabaseStrategy.authenticate(buildArgsWithoutReq())

      expect(ensurePatientOnAuth).toHaveBeenCalledWith({
        payload: mockPayload,
        authData: patientAuthData,
        req: undefined,
      })
      expect(identifyUser).toHaveBeenCalledWith(patientAuthData)
      expect(result.user).toEqual({
        collection: 'patients',
        ...patientUser,
      })
    })

    it('should fail closed when ensurePatientOnAuth returns null', async () => {
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

      vi.mocked(extractSupabaseUserData).mockResolvedValue(patientAuthData)
      vi.mocked(getUserConfig).mockReturnValue(patientConfig)
      vi.mocked(ensurePatientOnAuth).mockResolvedValue(null)

      const result = await supabaseStrategy.authenticate(buildArgsWithoutReq())

      expect(result.user).toBeNull()
      expect(validateUserAccess).not.toHaveBeenCalled()
      expect(identifyUser).not.toHaveBeenCalled()
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

      const result = await supabaseStrategy.authenticate(buildArgs())

      expect(identifyUser).toHaveBeenCalledWith(platformAuthData)
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
