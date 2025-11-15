/**
 * Unit Tests for anyone Access Function
 *
 * Tests the public access function that allows access to everyone,
 * including anonymous users.
 */

import { describe, test, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { anyone } from '@/access/anyone'

describe('anyone', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  test.each([
    { userType: 'Platform Staff', user: () => mockUsers.platform() },
    { userType: 'Clinic Staff', user: () => mockUsers.clinic() },
    { userType: 'Patient', user: () => mockUsers.patient() },
    { userType: 'Anonymous', user: () => mockUsers.anonymous() },
    { userType: 'Null', user: () => null },
    { userType: 'Undefined', user: () => undefined },
  ])('$userType returns true', ({ user }) => {
    const result = anyone(createAccessArgs(user()))
    expectAccess.full(result)
  })
})
