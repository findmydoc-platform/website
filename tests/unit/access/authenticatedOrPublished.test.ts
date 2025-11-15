/**
 * Unit Tests for authenticatedOrPublished Access Function
 *
 * Tests the conditional access function that allows full access to
 * authenticated users and published content access to anonymous users.
 */

import { describe, test, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'

describe('authenticatedOrPublished', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  const publishedFilter = {
    _status: {
      equals: 'published',
    },
  }

  test.each([
    { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: 'full' },
    { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: 'full' },
    { userType: 'Patient', user: () => mockUsers.patient(), expected: 'full' },
    { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: publishedFilter },
    { userType: 'Null', user: () => null, expected: publishedFilter },
    { userType: 'Undefined', user: () => undefined, expected: publishedFilter },
  ])('$userType gets expected access', ({ user, expected }) => {
    const result = authenticatedOrPublished(createAccessArgs(user()))
    if (expected === 'full') {
      expectAccess.full(result)
    } else {
      expectAccess.scoped(result, expected)
    }
  })
})
