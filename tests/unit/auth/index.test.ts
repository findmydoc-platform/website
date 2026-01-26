/**
 * Unit tests for auth module exports and index file.
 */

import { describe, it, expect } from 'vitest'

describe('auth module exports', () => {
  describe('main strategy export', () => {
    it('should export supabaseStrategy', async () => {
      const { supabaseStrategy } = await import('@/auth/index')

      expect(supabaseStrategy).toBeDefined()
      expect(supabaseStrategy.name).toBe('supabase')
      expect(typeof supabaseStrategy.authenticate).toBe('function')
    })
  })

  describe('configuration exports', () => {
    it('should export auth configuration functions', async () => {
      const { getUserConfig, validateAuthEnvironment, USER_CONFIG, VALID_USER_TYPES, AUTH_CONFIG } =
        await import('@/auth/index')

      expect(getUserConfig).toBeDefined()
      expect(typeof getUserConfig).toBe('function')

      expect(validateAuthEnvironment).toBeDefined()
      expect(typeof validateAuthEnvironment).toBe('function')

      expect(USER_CONFIG).toBeDefined()
      expect(typeof USER_CONFIG).toBe('object')

      expect(VALID_USER_TYPES).toBeDefined()
      expect(Array.isArray(VALID_USER_TYPES)).toBe(true)

      expect(AUTH_CONFIG).toBeDefined()
      expect(typeof AUTH_CONFIG).toBe('object')
    })
  })

  describe('utility exports', () => {
    it('should export JWT validation utilities', async () => {
      const { extractSupabaseUserData, extractTokenFromHeader, validateSupabaseUser, transformSupabaseUser } =
        await import('@/auth/index')

      expect(extractSupabaseUserData).toBeDefined()
      expect(typeof extractSupabaseUserData).toBe('function')

      expect(extractTokenFromHeader).toBeDefined()
      expect(typeof extractTokenFromHeader).toBe('function')

      expect(validateSupabaseUser).toBeDefined()
      expect(typeof validateSupabaseUser).toBe('function')

      expect(transformSupabaseUser).toBeDefined()
      expect(typeof transformSupabaseUser).toBe('function')
    })

    it('should export user lookup utilities', async () => {
      const { findUserBySupabaseId, isClinicUserApproved } = await import('@/auth/index')

      expect(findUserBySupabaseId).toBeDefined()
      expect(typeof findUserBySupabaseId).toBe('function')

      expect(isClinicUserApproved).toBeDefined()
      expect(typeof isClinicUserApproved).toBe('function')
    })

    it('should export user creation utilities', async () => {
      const { prepareUserData, createUser } = await import('@/auth/index')

      expect(prepareUserData).toBeDefined()
      expect(typeof prepareUserData).toBe('function')

      expect(createUser).toBeDefined()
      expect(typeof createUser).toBe('function')
    })

    it('should export access validation utilities', async () => {
      const { validateUserAccess, validateClinicAccess, validateUserTypePermissions } = await import('@/auth/index')

      expect(validateUserAccess).toBeDefined()
      expect(typeof validateUserAccess).toBe('function')

      expect(validateClinicAccess).toBeDefined()
      expect(typeof validateClinicAccess).toBe('function')

      expect(validateUserTypePermissions).toBeDefined()
      expect(typeof validateUserTypePermissions).toBe('function')
    })
  })

  describe('type exports', () => {
    it('should export types without runtime errors', async () => {
      // Import and use types to ensure they're properly exported
      const auth = await import('@/auth/index')

      // Types should be available for TypeScript but won't have runtime presence
      // We can at least verify the module imports without errors
      expect(auth).toBeDefined()
    })
  })

  describe('integration with config', () => {
    it('should provide working getUserConfig function', async () => {
      const { getUserConfig } = await import('@/auth/index')

      const clinicConfig = getUserConfig('clinic')
      expect(clinicConfig).toEqual({
        collection: 'basicUsers',
        profileCollection: 'clinicStaff',
        requiresProfile: true,
        requiresApproval: true,
      })

      const patientConfig = getUserConfig('patient')
      expect(patientConfig).toEqual({
        collection: 'patients',
        profileCollection: null,
        requiresProfile: false,
        requiresApproval: false,
      })
    })

    it('should provide working validateAuthEnvironment function', async () => {
      const { validateAuthEnvironment } = await import('@/auth/index')

      // This will depend on current environment variables
      const result = validateAuthEnvironment()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('clean imports', () => {
    it('should not have circular dependencies', async () => {
      // Import everything and ensure no errors
      const auth = await import('@/auth/index')

      expect(auth).toBeDefined()
      expect(Object.keys(auth).length).toBeGreaterThan(0)
    })

    it('should provide all documented exports', async () => {
      const auth = await import('@/auth/index')

      // Main strategy
      expect(auth.supabaseStrategy).toBeDefined()

      // Config
      expect(auth.getUserConfig).toBeDefined()
      expect(auth.validateAuthEnvironment).toBeDefined()
      expect(auth.USER_CONFIG).toBeDefined()
      expect(auth.VALID_USER_TYPES).toBeDefined()
      expect(auth.AUTH_CONFIG).toBeDefined()

      // JWT utilities
      expect(auth.extractSupabaseUserData).toBeDefined()
      expect(auth.extractTokenFromHeader).toBeDefined()
      expect(auth.validateSupabaseUser).toBeDefined()
      expect(auth.transformSupabaseUser).toBeDefined()

      // User utilities
      expect(auth.findUserBySupabaseId).toBeDefined()
      expect(auth.isClinicUserApproved).toBeDefined()
      expect(auth.prepareUserData).toBeDefined()
      expect(auth.createUser).toBeDefined()

      // Access utilities
      expect(auth.validateUserAccess).toBeDefined()
      expect(auth.validateClinicAccess).toBeDefined()
      expect(auth.validateUserTypePermissions).toBeDefined()
    })
  })
})
