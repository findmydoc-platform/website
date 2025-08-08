/**
 * Unit Tests for authenticatedOrApprovedClinic Access Function
 *
 * Tests the conditional access function that allows full access to
 * authenticated users and approved clinic access to anonymous users.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { authenticatedOrApprovedClinic } from '@/access/authenticatedOrApprovedClinic'

describe('authenticatedOrApprovedClinic', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  const approvedFilter = {
    status: {
      equals: 'approved',
    },
  }

  test.each([
    { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: 'full' },
    { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: 'full' },
    { userType: 'Patient', user: () => mockUsers.patient(), expected: 'full' },
    { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: approvedFilter },
    { userType: 'Null', user: () => null, expected: approvedFilter },
    { userType: 'Undefined', user: () => undefined, expected: approvedFilter },
  ])('$userType gets expected access', ({ user, expected }) => {
    const result = authenticatedOrApprovedClinic(createAccessArgs(user()))
    if (expected === 'full') {
      expectAccess.full(result)
    } else {
      expectAccess.scoped(result, expected)
    }
  })
})
