/**
 * Simple unit tests for JWT validation utilities.
 */

import { describe, it, expect } from 'vitest'
import { extractTokenFromHeader, validateSupabaseUser, transformSupabaseUser } from '@/auth/utilities/jwtValidation'
import type { User } from '@supabase/supabase-js'
import { createMockReq } from '../../helpers/testHelpers'

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

describe('jwtValidation utilities', () => {
  describe('extractTokenFromHeader', () => {
    it('should extract token from Authorization header', () => {
      const mockReq = createMockReq(undefined, undefined, {
        headers: new Headers([['authorization', 'Bearer test-token-123']]),
      })

      const result = extractTokenFromHeader(mockReq)
      expect(result).toBe('test-token-123')
    })

    it('should return undefined if no header', () => {
      const mockReq = createMockReq(undefined, undefined, { headers: new Headers() })

      const result = extractTokenFromHeader(mockReq)
      expect(result).toBeUndefined()
    })

    it('should return undefined if no req object', () => {
      const result = extractTokenFromHeader()
      expect(result).toBeUndefined()
    })
  })

  describe('validateSupabaseUser', () => {
    it('should validate user with all required fields', () => {
      const validUser = makeSupabaseUser()

      const result = validateSupabaseUser(validUser)
      expect(result).toBe(true)
    })

    it('should reject user without id', () => {
      const invalidUser = makeSupabaseUser({ id: '' })

      const result = validateSupabaseUser(invalidUser)
      expect(result).toBe(false)
    })

    it('should reject user with invalid user_type', () => {
      const invalidUser = makeSupabaseUser({ app_metadata: { user_type: 'invalid' } })

      const result = validateSupabaseUser(invalidUser)
      expect(result).toBe(false)
    })
  })

  describe('transformSupabaseUser', () => {
    it('should transform valid Supabase user to AuthData', () => {
      const supabaseUser = makeSupabaseUser({
        email: ' test@example.com ',
        app_metadata: { user_type: 'clinic' },
        user_metadata: {
          first_name: ' John ',
          last_name: ' Doe ',
        },
      })

      const result = transformSupabaseUser(supabaseUser)

      expect(result).toEqual({
        supabaseUserId: 'user-123',
        userEmail: 'test@example.com',
        userType: 'clinic',
        firstName: 'John',
        lastName: 'Doe',
      })
    })

    it('should handle missing user metadata', () => {
      const supabaseUser = makeSupabaseUser({
        app_metadata: { user_type: 'patient' },
        user_metadata: {},
      })

      const result = transformSupabaseUser(supabaseUser)

      expect(result.firstName).toBe('')
      expect(result.lastName).toBe('')
    })
  })
})
