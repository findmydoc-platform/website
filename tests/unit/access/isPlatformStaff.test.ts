/**
 * Test for Platform Staff Access Function
 *
 * This test verifies our helper utilities work correctly
 * by testing the isPlatformStaff function.
 * Follows existing project patterns from userProfileManagement.test.ts
 */

import { describe, it, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { isPlatformStaff, isPlatformStaffOrSelf } from '@/access/isPlatformStaff'
import { canRunPayloadJobs } from '@/access/payloadJobs'

describe('isPlatformStaff', () => {
  // Follow existing pattern from userProfileManagement.test.ts
  beforeEach(() => {
    clearAllMocks()
  })

  it('returns true for platform staff', () => {
    const result = isPlatformStaff(createAccessArgs(mockUsers.platform()))
    expectAccess.full(result)
  })

  it('returns false for clinic staff', () => {
    const result = isPlatformStaff(createAccessArgs(mockUsers.clinic()))
    expectAccess.none(result)
  })

  it('returns false for patient', () => {
    const result = isPlatformStaff(createAccessArgs(mockUsers.patient()))
    expectAccess.none(result)
  })

  it('returns false for anonymous user', () => {
    const result = isPlatformStaff(createAccessArgs(mockUsers.anonymous()))
    expectAccess.none(result)
  })

  it('returns false for null user', () => {
    const result = isPlatformStaff(createAccessArgs(null))
    expectAccess.none(result)
  })

  it('allows platform staff to access any user in self-or-admin mode', () => {
    const result = isPlatformStaffOrSelf(createAccessArgs(mockUsers.platform(), { extra: { id: 99 } }))
    expectAccess.full(result)
  })

  it('denies clinic staff access to platform principals', () => {
    const result = isPlatformStaffOrSelf(createAccessArgs(mockUsers.clinic(42), { extra: { id: 99 } }))
    expectAccess.none(result)
  })

  it('denies anonymous access', () => {
    const result = isPlatformStaffOrSelf(createAccessArgs(mockUsers.anonymous(), { extra: { id: 99 } }))
    expectAccess.none(result)
  })
})

describe('canRunPayloadJobs', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  it('allows platform staff to run Payload jobs', () => {
    const result = canRunPayloadJobs(createAccessArgs(mockUsers.platform()))
    expectAccess.full(result)
  })

  it('blocks clinic staff from running Payload jobs', () => {
    const result = canRunPayloadJobs(createAccessArgs(mockUsers.clinic()))
    expectAccess.none(result)
  })

  it('blocks patient users from running Payload jobs', () => {
    const result = canRunPayloadJobs(createAccessArgs(mockUsers.patient()))
    expectAccess.none(result)
  })

  it('blocks anonymous users from running Payload jobs', () => {
    const result = canRunPayloadJobs(createAccessArgs(mockUsers.anonymous()))
    expectAccess.none(result)
  })
})
