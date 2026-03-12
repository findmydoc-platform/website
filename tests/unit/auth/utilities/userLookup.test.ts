/**
 * Simple unit tests for user lookup utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findUserBySupabaseId, isClinicUserApproved } from '@/auth/utilities/userLookup'
import { getUserConfig } from '@/auth/config/authConfig'
import type { UserType } from '@/auth/types/authTypes'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import type { Payload, PayloadRequest } from 'payload'

// Mock payload
const mockPayload = createMockPayload()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('userLookup utilities', () => {
  describe('findUserBySupabaseId', () => {
    it('should find existing user', async () => {
      const mockUser = { id: 'user-123', supabaseUserId: 'supabase-123' }
      const req = createMockReq(undefined, mockPayload) as unknown as PayloadRequest
      mockPayload.find.mockResolvedValue({
        docs: [mockUser],
      })

      const authData = {
        supabaseUserId: 'supabase-123',
        userType: 'clinic' as const,
        userEmail: 'test@example.com',
      }

      const result = await findUserBySupabaseId(mockPayload as unknown as Payload, authData, req)
      expect(result).toEqual(mockUser)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'basicUsers',
        where: { supabaseUserId: { equals: 'supabase-123' } },
        limit: 1,
        overrideAccess: true,
        req,
      })
    })

    it('should return null if user not found', async () => {
      mockPayload.find.mockResolvedValueOnce({ docs: [] })

      const authData = {
        supabaseUserId: 'supabase-123',
        userType: 'clinic' as const,
        userEmail: 'test@example.com',
      }

      const result = await findUserBySupabaseId(mockPayload as unknown as Payload, authData)
      expect(result).toBeNull()
      expect(mockPayload.find).toHaveBeenCalledTimes(1)
    })

    it('falls back to source-cased email lookup for legacy records when email reconcile is enabled', async () => {
      const existingUser = {
        id: 'user-legacy',
        supabaseUserId: null,
        email: 'Test@Example.com',
      }
      const updatedUser = {
        id: 'user-legacy',
        supabaseUserId: 'supabase-legacy',
        email: 'test@example.com',
      }

      mockPayload.find
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [existingUser] })
      mockPayload.update.mockResolvedValue(updatedUser)

      const authData = {
        supabaseUserId: 'supabase-legacy',
        userType: 'clinic' as const,
        userEmail: 'Test@Example.com',
      }

      const result = await findUserBySupabaseId(mockPayload as unknown as Payload, authData, undefined, undefined, {
        allowEmailReconcile: true,
      })
      expect(result).toEqual(updatedUser)
      expect(mockPayload.find).toHaveBeenCalledTimes(3)
    })

    it('should reconcile by email and sync supabase user id when email reconcile is enabled', async () => {
      const existingUser = {
        id: 'user-123',
        supabaseUserId: null,
        email: 'test@example.com',
      }
      const updatedUser = {
        id: 'user-123',
        supabaseUserId: 'supabase-123',
        email: 'test@example.com',
      }
      mockPayload.find.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [existingUser] })
      mockPayload.update.mockResolvedValue(updatedUser)

      const authData = {
        supabaseUserId: 'supabase-123',
        userType: 'clinic' as const,
        userEmail: ' Test@Example.com ',
      }

      const result = await findUserBySupabaseId(mockPayload as unknown as Payload, authData, undefined, undefined, {
        allowEmailReconcile: true,
      })
      expect(result).toEqual(updatedUser)
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'basicUsers',
        id: 'user-123',
        data: {
          email: 'test@example.com',
          supabaseUserId: 'supabase-123',
        },
        overrideAccess: true,
        req: undefined,
        context: {
          skipSupabaseUserCreation: true,
          skipProfileCreation: true,
        },
      })
    })

    it('does not reconcile by email when email reconcile is disabled', async () => {
      mockPayload.find.mockResolvedValueOnce({ docs: [] })

      const authData = {
        supabaseUserId: 'supabase-disabled',
        userType: 'clinic' as const,
        userEmail: 'test@example.com',
      }

      const result = await findUserBySupabaseId(mockPayload as unknown as Payload, authData)

      expect(result).toBeNull()
      expect(mockPayload.update).not.toHaveBeenCalled()
      expect(mockPayload.find).toHaveBeenCalledTimes(1)
    })
  })

  describe('isClinicUserApproved', () => {
    it('should return true for approved clinic user', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'staff-123', status: 'approved' }],
      })

      const result = await isClinicUserApproved(mockPayload as unknown as Payload, 'user-123')
      expect(result).toBe(true)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'clinicStaff',
        where: {
          user: { equals: 'user-123' },
          status: { equals: 'approved' },
        },
        limit: 1,
        overrideAccess: true,
        req: undefined,
      })
    })

    it('should return false for non-approved clinic user', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [],
      })

      const result = await isClinicUserApproved(mockPayload as unknown as Payload, 'user-123')
      expect(result).toBe(false)
    })
  })

  describe('getUserConfig', () => {
    it('should return config for clinic user', () => {
      const result = getUserConfig('clinic')
      expect(result).toEqual({
        collection: 'basicUsers',
        profileCollection: 'clinicStaff',
        requiresProfile: true,
        requiresApproval: true,
      })
    })

    it('should return config for patient user', () => {
      const result = getUserConfig('patient')
      expect(result).toEqual({
        collection: 'patients',
        profileCollection: null,
        requiresProfile: false,
        requiresApproval: false,
      })
    })

    it('should throw error for invalid user type', () => {
      expect(() => {
        getUserConfig('invalid' as UserType)
      }).toThrow('Invalid user type: invalid')
    })
  })
})
