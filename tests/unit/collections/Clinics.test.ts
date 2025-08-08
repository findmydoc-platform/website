import { describe, test, expect, vi, beforeEach } from 'vitest'
import { Clinics } from '@/collections/Clinics'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

// Mock the scope filter functions
vi.mock('@/access/scopeFilters', () => ({
  platformOnlyOrApproved: vi.fn(),
  platformOrOwnClinicProfile: vi.fn(),
}))

import { platformOnlyOrApproved, platformOrOwnClinicProfile } from '@/access/scopeFilters'

describe('Clinics Collection Access Control', () => {
  const mockPlatformOnlyOrApproved = platformOnlyOrApproved as any
  const mockPlatformOrOwnClinicProfile = platformOrOwnClinicProfile as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Read Access', () => {
    test('uses platformOnlyOrApproved scope filter', () => {
      const req = createMockReq(mockUsers.platform())
      mockPlatformOnlyOrApproved.mockReturnValue(true)

      const result = Clinics.access!.read!({ req } as any)

      expect(mockPlatformOnlyOrApproved).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })

    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        mockReturn: true,
        description: 'gets access to all clinics'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        mockReturn: { status: { equals: 'approved' } },
        description: 'gets access to approved clinics only'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        mockReturn: { status: { equals: 'approved' } },
        description: 'gets access to approved clinics only'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        mockReturn: { status: { equals: 'approved' } },
        description: 'gets access to approved clinics only'
      }
    ])('$userType $description', ({ user, mockReturn }) => {
      const req = createMockReq(user())
      mockPlatformOnlyOrApproved.mockReturnValue(mockReturn)

      const result = Clinics.access!.read!({ req } as any)

      expect(result).toEqual(mockReturn)
    })
  })

  describe('Create Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can create clinics'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot create clinics'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot create clinics'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot create clinics'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Clinics.access!.create!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Update Access', () => {
    test('uses platformOrOwnClinicProfile scope filter', () => {
      const req = createMockReq(mockUsers.platform())
      mockPlatformOrOwnClinicProfile.mockReturnValue(true)

      const result = Clinics.access!.update!({ req } as any)

      expect(mockPlatformOrOwnClinicProfile).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })

    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        mockReturn: true,
        description: 'can update all clinics'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        mockReturn: { id: { equals: 1 } },
        description: 'can update own clinic profile only'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        mockReturn: false,
        description: 'cannot update clinics'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        mockReturn: false,
        description: 'cannot update clinics'
      }
    ])('$userType $description', ({ user, mockReturn }) => {
      const req = createMockReq(user())
      mockPlatformOrOwnClinicProfile.mockReturnValue(mockReturn)

      const result = Clinics.access!.update!({ req } as any)

      expect(result).toEqual(mockReturn)
    })
  })

  describe('Delete Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can delete clinics'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot delete clinics'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot delete clinics'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot delete clinics'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Clinics.access!.delete!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Collection Configuration', () => {
    test('has correct slug', () => {
      expect(Clinics.slug).toBe('clinics')
    })

    test('has correct admin configuration', () => {
      expect(Clinics.admin?.group).toBe('Medical Network')
      expect(Clinics.admin?.useAsTitle).toBe('name')
    })

    test('has all required access control functions', () => {
      expect(Clinics.access?.read).toBeDefined()
      expect(Clinics.access?.create).toBeDefined()
      expect(Clinics.access?.update).toBeDefined()
      expect(Clinics.access?.delete).toBeDefined()
    })

    test('read access uses correct scope filter', () => {
      expect(Clinics.access?.read).toBe(platformOnlyOrApproved)
    })

    test('update access uses correct scope filter', () => {
      expect(Clinics.access?.update).toBe(platformOrOwnClinicProfile)
    })
  })
})
