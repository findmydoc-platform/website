import { describe, test, expect } from 'vitest'
import { PlatformStaff } from '@/collections/PlatformStaff'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

describe('PlatformStaff Collection Access Control', () => {
  describe('Read Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can read all platform staff',
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot read platform staff',
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot read platform staff',
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot read platform staff',
      },
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = PlatformStaff.access!.read!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Create Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can create platform staff',
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot create platform staff',
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot create platform staff',
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot create platform staff',
      },
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = PlatformStaff.access!.create!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Update Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can update all platform staff',
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot update platform staff',
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot update platform staff',
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot update platform staff',
      },
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = PlatformStaff.access!.update!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Delete Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can delete platform staff',
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot delete platform staff',
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot delete platform staff',
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot delete platform staff',
      },
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = PlatformStaff.access!.delete!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Collection Configuration', () => {
    test('has correct slug', () => {
      expect(PlatformStaff.slug).toBe('platformStaff')
    })

    test('is not an auth collection', () => {
      expect(PlatformStaff.auth).toBe(false)
    })

    test('has correct admin configuration', () => {
      expect(PlatformStaff.admin?.group).toBe('User Management')
      expect(PlatformStaff.admin?.useAsTitle).toBe('firstName')
    })

    test('has all required access control functions', () => {
      expect(PlatformStaff.access?.read).toBeDefined()
      expect(PlatformStaff.access?.create).toBeDefined()
      expect(PlatformStaff.access?.update).toBeDefined()
      expect(PlatformStaff.access?.delete).toBeDefined()
    })

    test('all access functions use isPlatformBasicUser', () => {
      // PlatformStaff is a platform-only collection
      expect(PlatformStaff.access?.read).toBe(PlatformStaff.access?.create)
      expect(PlatformStaff.access?.create).toBe(PlatformStaff.access?.update)
      expect(PlatformStaff.access?.update).toBe(PlatformStaff.access?.delete)
    })
  })
})
