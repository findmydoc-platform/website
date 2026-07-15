/**
 * Unit Tests for isClinicStaff Access Functions
 *
 * Tests clinic staff identification and profile access functions.
 */

import { describe, test, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { isClinicStaff, isOwnClinicStaffProfile } from '@/access/isClinicStaff'

describe('isClinicStaff', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  describe('isClinicStaff', () => {
    test.each([
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: true },
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: false },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
      { userType: 'Null', user: () => null, expected: false },
      {
        userType: 'Wrong collection',
        user: () => ({ id: 123, collection: 'wrongCollection', userType: 'clinic' }),
        expected: false,
      },
      {
        userType: 'Wrong userType',
        user: () => ({ id: 123, collection: 'platformStaff' }),
        expected: false,
      },
    ])('$userType returns $expected', ({ user, expected }) => {
      const result = isClinicStaff(createAccessArgs(user()))
      if (expected) {
        expectAccess.full(result)
      } else {
        expectAccess.none(result)
      }
    })
  })

  describe('isOwnClinicStaffProfile', () => {
    test.each([
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(456),
        expected: { id: { equals: 456 } },
      },
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: false },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
      { userType: 'Null', user: () => null, expected: false },
    ])('$userType gets expected access', ({ user, expected }) => {
      const result = isOwnClinicStaffProfile(createAccessArgs(user()))
      if (expected === false) {
        expectAccess.none(result)
      } else {
        expectAccess.scoped(result, expected)
      }
    })
  })
})
