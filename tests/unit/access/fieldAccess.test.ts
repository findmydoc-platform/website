/**
 * Unit Tests for Field Access Control Functions
 *
 * Tests field-level access control functions used for restricting
 * access to administrative fields like approval status.
 */

import { describe, test, beforeEach, expect } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks, createMockPayload } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import {
  platformClinicTrustAccess,
  platformClinicTrustFieldAccess,
  platformOnlyFieldAccess,
} from '@/access/fieldAccess'

describe('Field Access Control', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  describe('platformOnlyFieldAccess', () => {
    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
      { userType: 'Null', user: () => null, expected: false },
      { userType: 'Undefined', user: () => undefined, expected: false },
      {
        userType: 'Wrong collection (patients)',
        user: () => ({ id: 123, collection: 'patients', userType: 'platform' }),
        expected: false,
      },
      {
        userType: 'Wrong userType (clinic)',
        user: () => ({ id: 123, collection: 'basicUsers', userType: 'clinic' }),
        expected: false,
      },
      {
        userType: 'Missing collection',
        user: () => ({ id: 123, userType: 'platform' }),
        expected: false,
      },
      {
        userType: 'Missing userType',
        user: () => ({ id: 123, collection: 'basicUsers' }),
        expected: false,
      },
    ])('$userType field access returns $expected', ({ user, expected }) => {
      const result = platformOnlyFieldAccess(createAccessArgs(user()))
      if (expected) {
        expectAccess.full(result)
      } else {
        expectAccess.none(result)
      }
    })
  })

  describe('platformClinicTrustFieldAccess', () => {
    test.each([
      { role: 'admin', expected: true },
      { role: 'support', expected: true },
      { role: 'content-manager', expected: false },
    ])('platform staff role $role returns $expected', async ({ role, expected }) => {
      const payload = createMockPayload()
      payload.find.mockResolvedValue({
        docs: expected ? [{ id: 10, role }] : [],
      })

      const result = await platformClinicTrustFieldAccess(createAccessArgs(mockUsers.platform(), { payload }))

      expect(result).toBe(expected)
      expect(payload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'platformStaff',
          where: expect.objectContaining({
            and: expect.arrayContaining([{ user: { equals: 1 } }, { role: { in: ['admin', 'support'] } }]),
          }),
        }),
      )
    })

    test('non-platform users are denied without role lookup', async () => {
      const payload = createMockPayload()

      const result = await platformClinicTrustFieldAccess(createAccessArgs(mockUsers.clinic(), { payload }))

      expect(result).toBe(false)
      expect(payload.find).not.toHaveBeenCalled()
    })

    test('role lookup errors fail closed', async () => {
      const payload = createMockPayload()
      payload.find.mockRejectedValue(new Error('lookup failed'))

      const result = await platformClinicTrustFieldAccess(createAccessArgs(mockUsers.platform(), { payload }))

      expect(result).toBe(false)
      expect(payload.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Unable to resolve platform staff role for clinic trust access',
      )
    })
  })

  describe('platformClinicTrustAccess', () => {
    test('allows platform admin and support staff', async () => {
      const payload = createMockPayload()
      payload.find.mockResolvedValue({ docs: [{ id: 10, role: 'support' }] })

      const result = await platformClinicTrustAccess(createAccessArgs(mockUsers.platform(), { payload }))

      expect(result).toBe(true)
    })

    test('denies platform staff without clinic trust role', async () => {
      const payload = createMockPayload()
      payload.find.mockResolvedValue({ docs: [] })

      const result = await platformClinicTrustAccess(createAccessArgs(mockUsers.platform(), { payload }))

      expect(result).toBe(false)
    })
  })
})
