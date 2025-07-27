import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AuthData } from '@/auth/types/authTypes'
import { identifyUser, resetIdentificationCache } from '@/posthog/identify'

// Mock the PostHog server module
vi.mock('@/posthog/server', () => ({
  getPostHogServer: vi.fn(),
}))

// Import the mocked server after mocking
import { getPostHogServer } from '@/posthog/server'

describe('PostHog identifyUser', () => {
  const mockIdentify = vi.fn()

  const mockAuthData: AuthData = {
    supabaseUserId: 'user-123',
    userEmail: 'test@example.com',
    userType: 'clinic' as const,
    firstName: 'John',
    lastName: 'Doe',
  }

  const mockAuthDataDifferentUser: AuthData = {
    supabaseUserId: 'user-456',
    userEmail: 'jane@example.com',
    userType: 'patient' as const,
    firstName: 'Jane',
    lastName: 'Smith',
  }

  beforeEach(() => {
    // Reset mocks and cache before each test
    vi.clearAllMocks()
    resetIdentificationCache()

    // Setup mock to return our controlled PostHog instance
    vi.mocked(getPostHogServer).mockReturnValue({
      identify: mockIdentify,
    } as any)
  })

  afterEach(() => {
    // Clean up after each test
    resetIdentificationCache()
  })

  describe('Caching Behavior (Performance Optimization)', () => {
    it('should call PostHog identify on first call for a user', async () => {
      await identifyUser(mockAuthData)

      expect(mockIdentify).toHaveBeenCalledTimes(1)
      expect(mockIdentify).toHaveBeenCalledWith({
        distinctId: 'user-123',
        properties: {
          email: 'test@example.com',
          user_type: 'clinic',
          first_name: 'John',
          last_name: 'Doe',
        },
      })
    })

    it('should NOT call PostHog on second call for same user (caching)', async () => {
      // First call
      await identifyUser(mockAuthData)
      expect(mockIdentify).toHaveBeenCalledTimes(1)

      // Second call with same user
      await identifyUser(mockAuthData)
      expect(mockIdentify).toHaveBeenCalledTimes(1) // Still only 1 call
    })

    it('should call PostHog for different users', async () => {
      // First user
      await identifyUser(mockAuthData)
      expect(mockIdentify).toHaveBeenCalledTimes(1)

      // Different user
      await identifyUser(mockAuthDataDifferentUser)
      expect(mockIdentify).toHaveBeenCalledTimes(2)
    })

    it('should re-identify user after cache reset', async () => {
      // First identification
      await identifyUser(mockAuthData)
      expect(mockIdentify).toHaveBeenCalledTimes(1)

      // Reset cache
      resetIdentificationCache()

      // Should identify again after reset
      await identifyUser(mockAuthData)
      expect(mockIdentify).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling (Authentication Safety)', () => {
    it('should not throw when PostHog identify fails', async () => {
      // Suppress console.warn for this test to keep output clean
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Setup PostHog to throw an error
      mockIdentify.mockImplementation(() => {
        throw new Error('PostHog API error')
      })

      // Should not throw
      await expect(identifyUser(mockAuthData)).resolves.toBeUndefined()

      // Restore console.warn
      warnSpy.mockRestore()
    })

    it('should not add user to cache if PostHog fails', async () => {
      // Suppress console.warn for this test to keep output clean
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Setup PostHog to throw an error
      mockIdentify.mockImplementation(() => {
        throw new Error('PostHog API error')
      })

      // First call fails
      await identifyUser(mockAuthData)

      // Fix PostHog for second call
      mockIdentify.mockImplementation(() => {})

      // Second call should still attempt identification (not cached)
      await identifyUser(mockAuthData)
      expect(mockIdentify).toHaveBeenCalledTimes(2)

      // Restore console.warn
      warnSpy.mockRestore()
    })

    it('should handle PostHog errors without breaking authentication flow', async () => {
      // Setup PostHog to throw an error
      mockIdentify.mockImplementation(() => {
        throw new Error('PostHog API error')
      })

      // Should complete without throwing (the key behavior we care about)
      await expect(identifyUser(mockAuthData)).resolves.toBeUndefined()

      // Verify the PostHog identify method was actually called (so we know error path was hit)
      expect(mockIdentify).toHaveBeenCalledTimes(1)
    })
  })

  describe('Data Handling', () => {
    it('should handle user data without optional fields', async () => {
      const minimalAuthData: AuthData = {
        supabaseUserId: 'user-minimal',
        userEmail: 'minimal@example.com',
        userType: 'platform',
        // No firstName or lastName
      }

      await identifyUser(minimalAuthData)

      expect(mockIdentify).toHaveBeenCalledWith({
        distinctId: 'user-minimal',
        properties: {
          email: 'minimal@example.com',
          user_type: 'platform',
          first_name: undefined,
          last_name: undefined,
        },
      })
    })

    it('should handle all user types correctly', async () => {
      const clinicUser = { ...mockAuthData, userType: 'clinic' as const }
      const platformUser = { ...mockAuthData, userType: 'platform' as const, supabaseUserId: 'user-platform' }
      const patientUser = { ...mockAuthData, userType: 'patient' as const, supabaseUserId: 'user-patient' }

      await identifyUser(clinicUser)
      await identifyUser(platformUser)
      await identifyUser(patientUser)

      expect(mockIdentify).toHaveBeenCalledTimes(3)

      // Check that user_type is correctly passed
      const calls = mockIdentify.mock.calls
      expect(calls[0]?.[0]?.properties?.user_type).toBe('clinic')
      expect(calls[1]?.[0]?.properties?.user_type).toBe('platform')
      expect(calls[2]?.[0]?.properties?.user_type).toBe('patient')
    })
  })
})
