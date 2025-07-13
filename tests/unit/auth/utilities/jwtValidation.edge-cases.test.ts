/**
 * Additional edge case tests for JWT validation utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'

// Mock the supabase client
vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/auth/utilities/supaBaseServer'

describe('jwtValidation edge cases', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('extractSupabaseUserData', () => {
    it('should handle token-based authentication', async () => {
      const mockReq = {
        headers: {
          get: vi.fn().mockImplementation((header: string) => {
            if (header === 'authorization' || header === 'Authorization') {
              return 'Bearer test-token'
            }
            return null
          }),
        },
      }

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: { user_type: 'clinic' },
        user_metadata: { first_name: 'John', last_name: 'Doe' },
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toEqual({
        supabaseUserId: 'user-123',
        userEmail: 'test@example.com',
        userType: 'clinic',
        firstName: 'John',
        lastName: 'Doe',
      })
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith('test-token')
    })

    it('should fall back to session-based authentication when no token', async () => {
      const mockReq = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      }

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: { user_type: 'patient' },
        user_metadata: {},
      }

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toEqual({
        supabaseUserId: 'user-123',
        userEmail: 'test@example.com',
        userType: 'patient',
        firstName: '',
        lastName: '',
      })
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith()
    })

    it('should return null when token validation fails', async () => {
      const mockReq = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer invalid-token'),
        },
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toBeNull()
    })

    it('should return null when session user is null', async () => {
      const mockReq = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toBeNull()
    })

    it('should return null when user validation fails', async () => {
      const mockReq = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer valid-token'),
        },
      }

      const invalidUser = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: { user_type: 'invalid' }, // Invalid user type
        user_metadata: {},
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: invalidUser },
        error: null,
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toBeNull()
    })

    it('should handle missing user metadata gracefully', async () => {
      const mockReq = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer valid-token'),
        },
      }

      const userWithoutMetadata = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: { user_type: 'platform' },
        // Missing user_metadata
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: userWithoutMetadata },
        error: null,
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toEqual({
        supabaseUserId: 'user-123',
        userEmail: 'test@example.com',
        userType: 'platform',
        firstName: '',
        lastName: '',
      })
    })

    it('should handle exceptions gracefully', async () => {
      const mockReq = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer valid-token'),
        },
      }

      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'))

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toBeNull()
    })

    it('should handle missing req parameter', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: { user_type: 'patient' },
        user_metadata: {},
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const result = await extractSupabaseUserData()

      expect(result).toEqual({
        supabaseUserId: 'user-123',
        userEmail: 'test@example.com',
        userType: 'patient',
        firstName: '',
        lastName: '',
      })
    })

    it('should trim email and names properly', async () => {
      const mockReq = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer valid-token'),
        },
      }

      const userWithSpaces = {
        id: 'user-123',
        email: '  test@example.com  ',
        app_metadata: { user_type: 'clinic' },
        user_metadata: {
          first_name: '  John  ',
          last_name: '  Doe  ',
        },
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: userWithSpaces },
        error: null,
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toEqual({
        supabaseUserId: 'user-123',
        userEmail: 'test@example.com',
        userType: 'clinic',
        firstName: 'John',
        lastName: 'Doe',
      })
    })
  })
})
