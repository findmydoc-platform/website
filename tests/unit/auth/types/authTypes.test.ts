/**
 * Unit tests for auth types and type guards.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import type { AuthData, UserResult, UserConfig, UserType } from '@/auth/types/authTypes'

describe('authTypes', () => {
  describe('AuthData interface', () => {
    it('should accept valid AuthData objects', () => {
      const validAuthData: AuthData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic',
        firstName: 'John',
        lastName: 'Doe',
      }

      expect(validAuthData.supabaseUserId).toBe('supabase-123')
      expect(validAuthData.userEmail).toBe('test@example.com')
      expect(validAuthData.userType).toBe('clinic')
      expect(validAuthData.firstName).toBe('John')
      expect(validAuthData.lastName).toBe('Doe')
    })

    it('should accept AuthData without optional fields', () => {
      const minimalAuthData: AuthData = {
        supabaseUserId: 'supabase-456',
        userEmail: 'minimal@example.com',
        userType: 'patient',
      }

      expect(minimalAuthData.supabaseUserId).toBe('supabase-456')
      expect(minimalAuthData.userEmail).toBe('minimal@example.com')
      expect(minimalAuthData.userType).toBe('patient')
      expect(minimalAuthData.firstName).toBeUndefined()
      expect(minimalAuthData.lastName).toBeUndefined()
    })

    it('should accept all valid user types', () => {
      const clinicAuth: AuthData = {
        supabaseUserId: 'id1',
        userEmail: 'clinic@test.com',
        userType: 'clinic',
      }

      const platformAuth: AuthData = {
        supabaseUserId: 'id2',
        userEmail: 'platform@test.com',
        userType: 'platform',
      }

      const patientAuth: AuthData = {
        supabaseUserId: 'id3',
        userEmail: 'patient@test.com',
        userType: 'patient',
      }

      expect(clinicAuth.userType).toBe('clinic')
      expect(platformAuth.userType).toBe('platform')
      expect(patientAuth.userType).toBe('patient')
    })
  })

  describe('UserResult interface', () => {
    it('should accept valid UserResult objects', () => {
      const userResult: UserResult = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          supabaseUserId: 'supabase-123',
        },
        collection: 'basicUsers',
      }

      expect(userResult.user.id).toBe('user-123')
      expect(userResult.collection).toBe('basicUsers')
    })

    it('should accept different collection types', () => {
      const basicUserResult: UserResult = {
        user: { id: 'basic-1' },
        collection: 'basicUsers',
      }

      const patientResult: UserResult = {
        user: { id: 'patient-1' },
        collection: 'patients',
      }

      expect(basicUserResult.collection).toBe('basicUsers')
      expect(patientResult.collection).toBe('patients')
    })
  })

  describe('UserConfig interface', () => {
    it('should accept clinic user config', () => {
      const clinicConfig: UserConfig = {
        collection: 'basicUsers',
        profileCollection: 'clinicStaff',
        requiresProfile: true,
        requiresApproval: true,
      }

      expect(clinicConfig.collection).toBe('basicUsers')
      expect(clinicConfig.profileCollection).toBe('clinicStaff')
      expect(clinicConfig.requiresProfile).toBe(true)
      expect(clinicConfig.requiresApproval).toBe(true)
    })

    it('should accept platform user config', () => {
      const platformConfig: UserConfig = {
        collection: 'basicUsers',
        profileCollection: 'platformStaff',
        requiresProfile: true,
        requiresApproval: false,
      }

      expect(platformConfig.collection).toBe('basicUsers')
      expect(platformConfig.profileCollection).toBe('platformStaff')
      expect(platformConfig.requiresProfile).toBe(true)
      expect(platformConfig.requiresApproval).toBe(false)
    })

    it('should accept patient user config', () => {
      const patientConfig: UserConfig = {
        collection: 'patients',
        profileCollection: null,
        requiresProfile: false,
        requiresApproval: false,
      }

      expect(patientConfig.collection).toBe('patients')
      expect(patientConfig.profileCollection).toBeNull()
      expect(patientConfig.requiresProfile).toBe(false)
      expect(patientConfig.requiresApproval).toBe(false)
    })
  })

  describe('UserType type', () => {
    it('should accept valid user types', () => {
      const clinic: UserType = 'clinic'
      const platform: UserType = 'platform'
      const patient: UserType = 'patient'

      expect(clinic).toBe('clinic')
      expect(platform).toBe('platform')
      expect(patient).toBe('patient')
    })
  })

  // Helper functions for type validation (if we had them)
  describe('type validation helpers', () => {
    function isValidUserType(userType: string): userType is UserType {
      return ['clinic', 'platform', 'patient'].includes(userType)
    }

    function isValidAuthData(data: any): data is AuthData {
      return (
        typeof data === 'object' &&
        data !== null &&
        typeof data.supabaseUserId === 'string' &&
        typeof data.userEmail === 'string' &&
        isValidUserType(data.userType) &&
        (data.firstName === undefined || typeof data.firstName === 'string') &&
        (data.lastName === undefined || typeof data.lastName === 'string')
      )
    }

    it('should validate user types correctly', () => {
      expect(isValidUserType('clinic')).toBe(true)
      expect(isValidUserType('platform')).toBe(true)
      expect(isValidUserType('patient')).toBe(true)
      expect(isValidUserType('invalid')).toBe(false)
      expect(isValidUserType('')).toBe(false)
    })

    it('should validate AuthData objects correctly', () => {
      const validData = {
        supabaseUserId: 'id-123',
        userEmail: 'test@example.com',
        userType: 'clinic',
        firstName: 'John',
        lastName: 'Doe',
      }

      const invalidData = {
        supabaseUserId: 123, // Wrong type
        userEmail: 'test@example.com',
        userType: 'clinic',
      }

      const missingData = {
        userEmail: 'test@example.com',
        userType: 'clinic',
        // Missing supabaseUserId
      }

      expect(isValidAuthData(validData)).toBe(true)
      expect(isValidAuthData(invalidData)).toBe(false)
      expect(isValidAuthData(missingData)).toBe(false)
      expect(isValidAuthData(null)).toBe(false)
      expect(isValidAuthData(undefined)).toBe(false)
    })
  })
})
