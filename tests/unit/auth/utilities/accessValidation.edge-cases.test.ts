/**
 * Additional edge case tests for access validation utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateClinicAccess,
  validateUserTypePermissions,
  validateUserAccess,
} from '@/auth/utilities/accessValidation'
import type { UserResult, UserType } from '@/auth/types/authTypes'
import type { ClinicStaff as PayloadClinicStaff, Patient } from '@/payload-types'
import { createMockPayload } from '../../helpers/testHelpers'
import type { Payload } from 'payload'

const accessStateMocks = vi.hoisted(() => ({
  readClinicAccessState: vi.fn(),
}))

vi.mock('@/auth/utilities/clinicAccessState', () => accessStateMocks)

type ClinicUser = PayloadClinicStaff
type ClinicUserOverrides = Partial<ClinicUser> & { userType?: string }

const makeClinicUser = (overrides: ClinicUserOverrides = {}): ClinicUser => ({
  id: overrides.id ?? 123,
  collection: 'clinicStaff',
  email: overrides.email ?? 'user@example.com',
  firstName: overrides.firstName ?? 'Test',
  lastName: overrides.lastName ?? 'User',
  stableId: overrides.stableId ?? 'clinic-user-123',
  status: overrides.status ?? 'approved',
  clinic: overrides.clinic,
  createdAt: overrides.createdAt ?? '2023-01-01',
  updatedAt: overrides.updatedAt ?? '2023-01-02',
  supabaseUserId: overrides.supabaseUserId,
  profileImage: overrides.profileImage,
})

const makePatient = (overrides: Partial<Patient> = {}): Patient => ({
  id: overrides.id ?? 456,
  collection: overrides.collection ?? 'patients',
  email: overrides.email ?? 'patient@example.com',
  firstName: overrides.firstName ?? 'Patient',
  lastName: overrides.lastName ?? 'User',
  createdAt: overrides.createdAt ?? '2023-01-01',
  updatedAt: overrides.updatedAt ?? '2023-01-02',
  supabaseUserId: overrides.supabaseUserId,
  dateOfBirth: overrides.dateOfBirth,
  gender: overrides.gender,
  phoneNumber: overrides.phoneNumber,
  address: overrides.address,
  country: overrides.country,
  language: overrides.language,
  profileImage: overrides.profileImage,
})

const basicUserResult = (overrides: ClinicUserOverrides = {}): UserResult => ({
  user: makeClinicUser(overrides),
  collection: 'clinicStaff',
})

const patientUserResult = (overrides: Partial<Patient> = {}): UserResult => ({
  user: makePatient(overrides),
  collection: 'patients',
})

describe('accessValidation edge cases', () => {
  let mockPayload: ReturnType<typeof createMockPayload>
  let payload: Payload

  beforeEach(() => {
    vi.clearAllMocks()
    accessStateMocks.readClinicAccessState.mockResolvedValue(null)
    mockPayload = createMockPayload()
    payload = mockPayload as unknown as Payload
  })

  describe('validateClinicAccess', () => {
    it('should handle database errors gracefully', async () => {
      accessStateMocks.readClinicAccessState.mockRejectedValue(new Error('Database connection failed'))

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult = basicUserResult({ id: 123, userType: 'clinic' })

      const result = await validateClinicAccess(payload, authData, userResult)
      expect(result).toBe(false)
    })

    it('should handle patient user type correctly', async () => {
      const authData = {
        supabaseUserId: 'supabase-patient',
        userEmail: 'patient@example.com',
        userType: 'patient' as const,
      }

      const userResult = patientUserResult({ id: 456 })

      const result = await validateClinicAccess(payload, authData, userResult)
      expect(result).toBe(true)
      // Should not call find for non-clinic users
      expect(mockPayload.find).not.toHaveBeenCalled()
    })

    it('should allow an access-ready staff principal assigned to an approved clinic', async () => {
      accessStateMocks.readClinicAccessState.mockResolvedValue({ clinic: { id: 44 }, staff: { id: 123 } })

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult = basicUserResult({ id: 123, userType: 'clinic' })

      const result = await validateClinicAccess(payload, authData, userResult)
      expect(result).toBe(true)
    })
  })

  describe('validateUserTypePermissions', () => {
    it('should handle null user type', () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: null as unknown as UserType,
      }

      const result = validateUserTypePermissions(authData)
      expect(result).toBe(false)
    })

    it('should handle undefined user type', () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: undefined as unknown as UserType,
      }

      const result = validateUserTypePermissions(authData)
      expect(result).toBe(false)
    })

    it('should handle empty string user type', () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: '' as unknown as UserType,
      }

      const result = validateUserTypePermissions(authData)
      expect(result).toBe(false)
    })

    it('should handle case-sensitive user types', () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'CLINIC' as unknown as UserType, // Uppercase should fail
      }

      const result = validateUserTypePermissions(authData)
      expect(result).toBe(false)
    })
  })

  describe('validateUserAccess', () => {
    it('should fail early on invalid user type', async () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'invalid' as unknown as UserType,
      }

      const userResult = basicUserResult({ id: 123, userType: 'clinic' })

      const result = await validateUserAccess(payload, authData, userResult)
      expect(result).toBe(false)
      expect(accessStateMocks.readClinicAccessState).not.toHaveBeenCalled()
    })

    it('should fail when clinic access is denied', async () => {
      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult = basicUserResult({ id: 123, userType: 'clinic' })

      const result = await validateUserAccess(payload, authData, userResult)
      expect(result).toBe(false)
    })

    it('should pass for platform users without clinic checks', async () => {
      const authData = {
        supabaseUserId: 'supabase-platform',
        userEmail: 'platform@findmydoc.eu',
        userType: 'platform' as const,
      }

      const userResult = basicUserResult({ id: 789, userType: 'platform' })

      const result = await validateUserAccess(payload, authData, userResult)
      expect(result).toBe(true)
      // Should not call find for platform users
      expect(mockPayload.find).not.toHaveBeenCalled()
    })

    it('should pass for patient users without clinic checks', async () => {
      const authData = {
        supabaseUserId: 'supabase-patient',
        userEmail: 'patient@example.com',
        userType: 'patient' as const,
      }

      const userResult = patientUserResult({ id: 234 })

      const result = await validateUserAccess(payload, authData, userResult)
      expect(result).toBe(true)
      // Should not call find for patient users
      expect(mockPayload.find).not.toHaveBeenCalled()
    })

    it('should handle database errors during clinic validation', async () => {
      accessStateMocks.readClinicAccessState.mockRejectedValue(new Error('Database timeout'))

      const authData = {
        supabaseUserId: 'supabase-123',
        userEmail: 'test@example.com',
        userType: 'clinic' as const,
      }

      const userResult = basicUserResult({ id: 123, userType: 'clinic' })

      const result = await validateUserAccess(payload, authData, userResult)
      expect(result).toBe(false)
    })
  })
})
