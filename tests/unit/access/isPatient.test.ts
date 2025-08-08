/**
 * Unit Tests for isPatient Access Functions
 *
 * Tests patient identification and profile access functions.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { isPatient, isOwnPatient } from '@/access/isPatient'

describe('isPatient', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  describe('isPatient', () => {
    test.each([
      { userType: 'Patient', user: () => mockUsers.patient(), expected: true },
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: false },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
      { userType: 'Null', user: () => null, expected: false },
      {
        userType: 'Wrong collection',
        user: () => ({ id: 123, collection: 'basicUsers' }),
        expected: false,
      },
    ])('$userType returns $expected', ({ user, expected }) => {
      const result = isPatient(createAccessArgs(user()))
      if (expected) {
        expectAccess.full(result)
      } else {
        expectAccess.none(result)
      }
    })
  })

  describe('isOwnPatient', () => {
    test('Patient gets access to own profile only (with filter)', () => {
      const patientUser = mockUsers.patient(789)
      const result = isOwnPatient(createAccessArgs(patientUser))
      expectAccess.scoped(result, {
        id: {
          equals: 789,
        },
      })
    })

    test('Patient gets access to own profile only (with id check)', () => {
      const patientUser = mockUsers.patient(789)
      const args = createAccessArgs(patientUser)
      args.id = 789
      const result = isOwnPatient(args)
      expectAccess.full(result)
    })

    test('Patient denied access to different profile (with id check)', () => {
      const patientUser = mockUsers.patient(789)
      const args = createAccessArgs(patientUser)
      args.id = 456 // Different ID
      const result = isOwnPatient(args)
      expectAccess.none(result)
    })

    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform() },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic() },
      { userType: 'Anonymous', user: () => mockUsers.anonymous() },
      { userType: 'Null', user: () => null },
    ])('$userType gets no access', ({ user }) => {
      const result = isOwnPatient(createAccessArgs(user()))
      expectAccess.none(result)
    })
  })
})
