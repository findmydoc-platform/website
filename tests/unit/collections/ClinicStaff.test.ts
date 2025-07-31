import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ClinicStaff } from '@/collections/ClinicStaff'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

// Mock the clinic assignment utility
vi.mock('@/access/utils/getClinicAssignment', () => ({
  getUserAssignedClinicId: vi.fn(),
}))

import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'

describe('ClinicStaff Collection Access Control', () => {
  const mockGetUserAssignedClinicId = getUserAssignedClinicId as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Read Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        setupMock: () => {},
        expected: true,
        description: 'gets full access to all clinic staff'
      },
      {
        userType: 'Clinic Staff with assignment',
        user: () => mockUsers.clinic(2, 1),
        setupMock: () => mockGetUserAssignedClinicId.mockResolvedValue(1),
        expected: { clinic: { equals: 1 } },
        description: 'gets scoped access to own clinic staff only'
      },
      {
        userType: 'Clinic Staff without assignment',
        user: () => mockUsers.clinic(2),
        setupMock: () => mockGetUserAssignedClinicId.mockResolvedValue(null),
        expected: false,
        description: 'gets no access without clinic assignment'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        setupMock: () => {},
        expected: false,
        description: 'cannot read clinic staff'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        setupMock: () => {},
        expected: false,
        description: 'cannot read clinic staff'
      }
    ])('$userType $description', async ({ user, setupMock, expected }) => {
      const req = createMockReq(user())
      setupMock()

      const result = await ClinicStaff.access!.read!({ req } as any)

      expect(result).toEqual(expected)
    })
  })

  describe('Create Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can create clinic staff'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot create clinic staff'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot create clinic staff'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot create clinic staff'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = ClinicStaff.access!.create!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Update Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can update all clinic staff'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot update clinic staff'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot update clinic staff'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot update clinic staff'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = ClinicStaff.access!.update!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Delete Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can delete clinic staff'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot delete clinic staff'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot delete clinic staff'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot delete clinic staff'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = ClinicStaff.access!.delete!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Collection Configuration', () => {
    test('has correct slug', () => {
      expect(ClinicStaff.slug).toBe('clinicStaff')
    })

    test('is not an auth collection', () => {
      expect(ClinicStaff.auth).toBe(false)
    })

    test('has correct admin configuration', () => {
      expect(ClinicStaff.admin?.group).toBe('User Management')
      expect(ClinicStaff.admin?.useAsTitle).toBe('firstName')
    })

    test('has all required access control functions', () => {
      expect(ClinicStaff.access?.read).toBeDefined()
      expect(ClinicStaff.access?.create).toBeDefined()
      expect(ClinicStaff.access?.update).toBeDefined()
      expect(ClinicStaff.access?.delete).toBeDefined()
    })
  })
})
