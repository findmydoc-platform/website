import { describe, test, expect } from 'vitest'
import { Countries } from '@/collections/Countries'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

describe('Countries Collection Access Control', () => {
  describe('Read Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can read all countries'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: true,
        description: 'can read all countries'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: true,
        description: 'can read all countries'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: true,
        description: 'can read all countries'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Countries.access!.read!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Create Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can create countries'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot create countries'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot create countries'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot create countries'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Countries.access!.create!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Update Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can update countries'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot update countries'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot update countries'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot update countries'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Countries.access!.update!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Delete Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can delete countries'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot delete countries'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot delete countries'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot delete countries'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Countries.access!.delete!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Collection Configuration', () => {
    test('has correct slug', () => {
      expect(Countries.slug).toBe('countries')
    })

    test('has correct admin configuration', () => {
      expect(Countries.admin?.group).toBe('Location Data')
      expect(Countries.admin?.useAsTitle).toBe('name')
    })

    test('has all required access control functions', () => {
      expect(Countries.access?.read).toBeDefined()
      expect(Countries.access?.create).toBeDefined()
      expect(Countries.access?.update).toBeDefined()
      expect(Countries.access?.delete).toBeDefined()
    })

    test('read access allows anyone', () => {
      expect(Countries.access?.read).toBeDefined()
      // Test that it returns true for anyone
      expect(Countries.access!.read!({ req: createMockReq(null) } as any)).toBe(true)
    })
  })
})
