import { describe, test, expect } from 'vitest'
import { BasicUsers } from '@/collections/BasicUsers'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

describe('BasicUsers Collection Access Control', () => {
  describe('Read Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can read all basic users'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot read basic users'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot read basic users'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot read basic users'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = BasicUsers.access!.read!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Create Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can create basic users'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot create basic users'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot create basic users'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot create basic users'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = BasicUsers.access!.create!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Update Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can update all basic users'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot update basic users'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot update basic users'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot update basic users'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = BasicUsers.access!.update!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Delete Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can delete basic users'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot delete basic users'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot delete basic users'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot delete basic users'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = BasicUsers.access!.delete!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Authentication Configuration', () => {
    test('uses Supabase authentication strategy', () => {
      const authConfig = BasicUsers.auth as any
      expect(authConfig?.useSessions).toBe(false)
      expect(authConfig?.disableLocalStrategy).toBe(true)
      expect(authConfig?.strategies).toBeDefined()
    })

    test('has correct slug', () => {
      expect(BasicUsers.slug).toBe('basicUsers')
    })

    test('has correct admin configuration', () => {
      expect(BasicUsers.admin?.group).toBe('User Management')
      expect(BasicUsers.admin?.useAsTitle).toBe('email')
    })

    test('has all required access control functions', () => {
      expect(BasicUsers.access?.read).toBeDefined()
      expect(BasicUsers.access?.create).toBeDefined()
      expect(BasicUsers.access?.update).toBeDefined()
      expect(BasicUsers.access?.delete).toBeDefined()
    })

    test('has afterChange hook for user profile creation', () => {
      expect(BasicUsers.hooks?.afterChange).toBeDefined()
      expect(Array.isArray(BasicUsers.hooks?.afterChange)).toBe(true)
    })
  })
})
