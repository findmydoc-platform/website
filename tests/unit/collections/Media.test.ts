import { describe, test, expect } from 'vitest'
import { Media } from '@/collections/Media'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

describe('Media Collection Access Control', () => {
  describe('Read Access', () => {
    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: true },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: true },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: true },
    ])('$userType can read? $expected', ({ user, expected }) => {
      const req = createMockReq(user())
      const result = Media.access!.read!({ req } as any)
      expect(result).toBe(expected)
    })
  })

  describe('Create/Update/Delete Access', () => {
    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
    ])('$userType can create?', ({ user, expected }) => {
      const req = createMockReq(user())
      const result = Media.access!.create!({ req } as any)
      expect(result).toBe(expected)
    })

    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
    ])('$userType can update?', ({ user, expected }) => {
      const req = createMockReq(user())
      const result = Media.access!.update!({ req } as any)
      expect(result).toBe(expected)
    })

    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
    ])('$userType can delete?', ({ user, expected }) => {
      const req = createMockReq(user())
      const result = Media.access!.delete!({ req } as any)
      expect(result).toBe(expected)
    })
  })
})
