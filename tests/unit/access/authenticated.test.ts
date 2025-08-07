/**
 * Unit Tests for authenticated Access Function
 *
 * Tests the basic authentication check that verifies if a user is logged in.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { authenticated } from '@/access/authenticated'

describe('authenticated', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  test.each([
    { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
    { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: true },
    { userType: 'Patient', user: () => mockUsers.patient(), expected: true },
    { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
    { userType: 'Null', user: () => null, expected: false },
    { userType: 'Undefined', user: () => undefined, expected: false },
  ])('$userType user returns $expected', ({ user, expected }) => {
    const result = authenticated(createAccessArgs(user()))
    if (expected) {
      expectAccess.full(result)
    } else {
      expectAccess.none(result)
    }
  })
})
