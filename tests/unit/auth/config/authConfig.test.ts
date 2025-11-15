/**
 * Unit tests for auth configuration module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  VALID_USER_TYPES,
  USER_CONFIG,
  AUTH_CONFIG,
  validateAuthEnvironment,
  getUserConfig,
} from '@/auth/config/authConfig'

describe('authConfig', () => {
  describe('VALID_USER_TYPES', () => {
    it('should contain expected user types', () => {
      expect(VALID_USER_TYPES).toEqual(['clinic', 'platform', 'patient'])
    })

    it('should be readonly array', () => {
      expect(Array.isArray(VALID_USER_TYPES)).toBe(true)
      expect(VALID_USER_TYPES.length).toBe(3)
    })
  })

  describe('USER_CONFIG', () => {
    it('should have correct clinic configuration', () => {
      expect(USER_CONFIG.clinic).toEqual({
        collection: 'basicUsers',
        profileCollection: 'clinicStaff',
        requiresProfile: true,
        requiresApproval: true,
      })
    })

    it('should have correct platform configuration', () => {
      expect(USER_CONFIG.platform).toEqual({
        collection: 'basicUsers',
        profileCollection: 'platformStaff',
        requiresProfile: true,
        requiresApproval: false,
      })
    })

    it('should have correct patient configuration', () => {
      expect(USER_CONFIG.patient).toEqual({
        collection: 'patients',
        profileCollection: null,
        requiresProfile: false,
        requiresApproval: false,
      })
    })
  })

  describe('AUTH_CONFIG', () => {
    it('should have expected configuration values', () => {
      expect(AUTH_CONFIG.JWT_EXPIRY_BUFFER).toBe(60)
      expect(AUTH_CONFIG.MAX_LOOKUP_RETRIES).toBe(3)
      expect(AUTH_CONFIG.USER_CREATION_TIMEOUT).toBe(10000)
      expect(Array.isArray(AUTH_CONFIG.REQUIRED_ENV_VARS)).toBe(true)
    })

    it('should have required environment variables list', () => {
      expect(AUTH_CONFIG.REQUIRED_ENV_VARS).toEqual(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET'])
    })
  })

  describe('validateAuthEnvironment', () => {
    const originalEnv = process.env

    beforeEach(() => {
      // Reset environment
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should return true when all required env vars are present', () => {
      process.env.SUPABASE_URL = 'test-url'
      process.env.SUPABASE_ANON_KEY = 'test-key'
      process.env.SUPABASE_JWT_SECRET = 'test-secret'

      const result = validateAuthEnvironment()
      expect(result).toBe(true)
    })

    it('should return false when required env vars are missing', () => {
      delete process.env.SUPABASE_URL
      delete process.env.SUPABASE_ANON_KEY
      delete process.env.SUPABASE_JWT_SECRET

      const result = validateAuthEnvironment()
      expect(result).toBe(false)
    })

    it('should return false when only some env vars are present', () => {
      process.env.SUPABASE_URL = 'test-url'
      delete process.env.SUPABASE_ANON_KEY
      delete process.env.SUPABASE_JWT_SECRET

      const result = validateAuthEnvironment()
      expect(result).toBe(false)
    })
  })

  describe('getUserConfig', () => {
    it('should return clinic config for clinic user type', () => {
      const result = getUserConfig('clinic')
      expect(result).toEqual(USER_CONFIG.clinic)
    })

    it('should return platform config for platform user type', () => {
      const result = getUserConfig('platform')
      expect(result).toEqual(USER_CONFIG.platform)
    })

    it('should return patient config for patient user type', () => {
      const result = getUserConfig('patient')
      expect(result).toEqual(USER_CONFIG.patient)
    })

    it('should throw error for invalid user type', () => {
      expect(() => {
        getUserConfig('invalid')
      }).toThrow('Invalid user type: invalid')
    })

    it('should throw error for empty string', () => {
      expect(() => {
        getUserConfig('')
      }).toThrow('Invalid user type: ')
    })

    it('should throw error for null', () => {
      expect(() => {
        // @ts-expect-error - intentionally passing null for test
        getUserConfig(null)
      }).toThrow('Invalid user type: null')
    })
  })
})
