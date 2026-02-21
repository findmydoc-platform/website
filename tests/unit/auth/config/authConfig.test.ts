/**
 * Unit tests for auth configuration module.
 */

import { describe, it, expect } from 'vitest'
import { VALID_USER_TYPES, USER_CONFIG, getUserConfig } from '@/auth/config/authConfig'

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
