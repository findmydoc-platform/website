/**
 * Unit Tests for authenticatedAndAdmin Access Function
 *
 * Tests the admin access function that requires both authentication
 * and platform staff privileges.
 */

import { describe, test, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { authenticatedAndAdmin } from '@/access/authenticatedAndAdmin'

describe('authenticatedAndAdmin', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  test.each([
    { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
    { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
    { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
    { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
    { userType: 'Null', user: () => null, expected: false },
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
  ])('$userType returns $expected', ({ user, expected }) => {
    const result = authenticatedAndAdmin(createAccessArgs(user()))
    if (expected) {
      expectAccess.full(result)
    } else {
      expectAccess.none(result)
    }
  })
})
