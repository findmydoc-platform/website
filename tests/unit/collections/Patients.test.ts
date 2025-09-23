import { describe, test, expect } from 'vitest'
import { Patients } from '@/collections/Patients'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

describe('Patients Collection Access Control', () => {
  describe('Read Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can read all patients',
      },
      {
        userType: 'Patient (own record)',
        user: () => mockUsers.patient('3'),
        expected: { id: { equals: '3' } },
        description: 'can read own record only',
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot read patients',
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot read patients',
      },
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Patients.access!.read!({ req } as any)

      expect(result).toEqual(expected)
    })
  })

  describe('Create Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can create patients',
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot create patients',
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot create patients',
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot create patients',
      },
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Patients.access!.create!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Update Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        docId: 'any-id',
        expected: true,
        description: 'can update any patient',
      },
      {
        userType: 'Patient (own record)',
        user: () => mockUsers.patient('3'),
        docId: '3',
        expected: true,
        description: 'can update own record',
      },
      {
        userType: 'Patient (different record)',
        user: () => mockUsers.patient('3'),
        docId: '5',
        expected: false,
        description: 'cannot update different patient record',
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        docId: 'any-id',
        expected: false,
        description: 'cannot update patients',
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        docId: 'any-id',
        expected: false,
        description: 'cannot update patients',
      },
    ])('$userType $description', ({ user, docId, expected }) => {
      const req = createMockReq(user())

      const result = Patients.access!.update!({ req, id: docId } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Delete Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can delete patients',
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot delete patients',
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot delete patients',
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot delete patients',
      },
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Patients.access!.delete!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Authentication Configuration', () => {
    test('uses Supabase authentication strategy', () => {
      const authConfig = Patients.auth as any
      expect(authConfig?.useSessions).toBe(false)
      expect(authConfig?.disableLocalStrategy).toBe(true)
      expect(authConfig?.strategies).toBeDefined()
    })

    test('has correct slug', () => {
      expect(Patients.slug).toBe('patients')
    })

    test('has correct admin configuration', () => {
      expect(Patients.admin?.group).toBe('User Management')
      expect(Patients.admin?.useAsTitle).toBe('email')
      expect(Patients.admin?.hidden).toBe(false)
    })

    test('has all required access control functions', () => {
      expect(Patients.access?.read).toBeDefined()
      expect(Patients.access?.create).toBeDefined()
      expect(Patients.access?.update).toBeDefined()
      expect(Patients.access?.delete).toBeDefined()
    })
  })
})
