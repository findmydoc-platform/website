/**
 * Unit Tests for Field Access Control Functions
 *
 * Tests field-level access control functions used for restricting
 * access to administrative fields like approval status.
 */

import { describe, test, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { platformOnlyFieldAccess } from '@/access/fieldAccess'

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
})
