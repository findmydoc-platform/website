/**
 * Test for Platform Staff Access Function
 *
 * This test verifies our helper utilities work correctly
 * by testing the isPlatformBasicUser function.
 * Follows existing project patterns from userProfileManagement.test.ts
 */

import { describe, it, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

describe('isPlatformBasicUser', () => {
  // Follow existing pattern from userProfileManagement.test.ts
  beforeEach(() => {
    clearAllMocks()
  })

  it('returns true for platform staff', () => {
    const result = isPlatformBasicUser(createAccessArgs(mockUsers.platform()))
    expectAccess.full(result)
  })

  it('returns false for clinic staff', () => {
    const result = isPlatformBasicUser(createAccessArgs(mockUsers.clinic()))
    expectAccess.none(result)
  })

  it('returns false for patient', () => {
    const result = isPlatformBasicUser(createAccessArgs(mockUsers.patient()))
    expectAccess.none(result)
  })

  it('returns false for anonymous user', () => {
    const result = isPlatformBasicUser(createAccessArgs(mockUsers.anonymous()))
    expectAccess.none(result)
  })

  it('returns false for null user', () => {
    const result = isPlatformBasicUser(createAccessArgs(null))
    expectAccess.none(result)
  })
})
