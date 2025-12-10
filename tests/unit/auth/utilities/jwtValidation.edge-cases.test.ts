/**
 * Additional edge case tests for JWT validation utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import type { User } from '@supabase/supabase-js'
import { createMockReq } from '../../helpers/testHelpers'

// Mock the supabase client
vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/auth/utilities/supaBaseServer'

const makeSupabaseUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  app_metadata: { user_type: 'clinic' },
  user_metadata: { first_name: 'John', last_name: 'Doe' },
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
  identities: [],
  is_anonymous: false,
  factors: [],
  phone: '',
  ...overrides,
})

describe('jwtValidation edge cases', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('extractSupabaseUserData', () => {
    it('should handle token-based authentication', async () => {
      const mockReq = createMockReq(undefined, undefined, {
        headers: new Headers([['authorization', 'Bearer test-token']]),
      })

      const mockUser = makeSupabaseUser()

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
      const mockReq = createMockReq(undefined, undefined, { headers: new Headers() })

      const mockUser = makeSupabaseUser({ app_metadata: { user_type: 'patient' }, user_metadata: {} })

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
      const mockReq = createMockReq(undefined, undefined, {
        headers: new Headers([['authorization', 'Bearer invalid-token']]),
      })

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toBeNull()
    })

    it('should return null when session user is null', async () => {
      const mockReq = createMockReq(undefined, undefined, { headers: new Headers() })

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toBeNull()
    })

    it('should return null when user validation fails', async () => {
      const mockReq = createMockReq(undefined, undefined, {
        headers: new Headers([['authorization', 'Bearer valid-token']]),
      })

      const invalidUser = makeSupabaseUser({ app_metadata: { user_type: 'invalid' }, user_metadata: {} })

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: invalidUser },
        error: null,
      })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toBeNull()
    })

    it('should handle missing user metadata gracefully', async () => {
      const mockReq = createMockReq(undefined, undefined, {
        headers: new Headers([['authorization', 'Bearer valid-token']]),
      })

      const userWithoutMetadata = makeSupabaseUser({
        app_metadata: { user_type: 'platform' },
        user_metadata: {},
      })

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
      const mockReq = createMockReq(undefined, undefined, {
        headers: new Headers([['authorization', 'Bearer valid-token']]),
      })

      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'))

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toBeNull()
    })

    it('should handle missing req parameter', async () => {
      const mockUser = makeSupabaseUser({ app_metadata: { user_type: 'patient' }, user_metadata: {} })

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const mockReq = createMockReq(undefined, undefined, { headers: new Headers() })

      const result = await extractSupabaseUserData(mockReq)

      expect(result).toEqual({
        supabaseUserId: 'user-123',
        userEmail: 'test@example.com',
        userType: 'patient',
        firstName: '',
        lastName: '',
      })
    })

    it('should trim email and names properly', async () => {
      const mockReq = createMockReq(undefined, undefined, {
        headers: new Headers([['authorization', 'Bearer valid-token']]),
      })

      const userWithSpaces = makeSupabaseUser({
        email: '  test@example.com  ',
        app_metadata: { user_type: 'clinic' },
        user_metadata: {
          first_name: '  John  ',
          last_name: '  Doe  ',
        },
      })

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
