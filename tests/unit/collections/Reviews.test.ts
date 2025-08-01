import { describe, test, expect, vi, beforeEach } from 'vitest'
import { Reviews } from '@/collections/Reviews'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

// Mock the scope filter functions
vi.mock('@/access/scopeFilters', () => ({
  platformOnlyOrApprovedReviews: vi.fn(),
}))

// Mock the hooks
vi.mock('@/hooks/calculations/updateAverageRatings', () => ({
  updateAverageRatingsAfterChange: vi.fn(),
  updateAverageRatingsAfterDelete: vi.fn(),
}))

import { platformOnlyOrApprovedReviews } from '@/access/scopeFilters'

describe('Reviews Collection Access Control', () => {
  const mockPlatformOnlyOrApprovedReviews = platformOnlyOrApprovedReviews as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Read Access', () => {
    test('uses platformOnlyOrApprovedReviews scope filter', () => {
      const req = createMockReq(mockUsers.platform())
      mockPlatformOnlyOrApprovedReviews.mockReturnValue(true)

      const result = Reviews.access!.read!({ req } as any)

      expect(mockPlatformOnlyOrApprovedReviews).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })

    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        mockReturn: true,
        description: 'gets access to all reviews'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        mockReturn: { status: { equals: 'approved' } },
        description: 'gets access to approved reviews only'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        mockReturn: { status: { equals: 'approved' } },
        description: 'gets access to approved reviews only'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        mockReturn: { status: { equals: 'approved' } },
        description: 'gets access to approved reviews only'
      }
    ])('$userType $description', ({ user, mockReturn }) => {
      const req = createMockReq(user())
      mockPlatformOnlyOrApprovedReviews.mockReturnValue(mockReturn)

      const result = Reviews.access!.read!({ req } as any)

      expect(result).toEqual(mockReturn)
    })
  })

  describe('Create Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can create reviews'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: true,
        description: 'can create reviews'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot create reviews'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot create reviews'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Reviews.access!.create!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Update Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can update reviews for moderation'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot update reviews - must contact support'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot update reviews'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot update reviews'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Reviews.access!.update!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Delete Access', () => {
    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        expected: true,
        description: 'can delete reviews for moderation'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        expected: false,
        description: 'cannot delete reviews'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        expected: false,
        description: 'cannot delete reviews'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        expected: false,
        description: 'cannot delete reviews'
      }
    ])('$userType $description', ({ user, expected }) => {
      const req = createMockReq(user())

      const result = Reviews.access!.delete!({ req } as any)

      expect(result).toBe(expected)
    })
  })

  describe('Collection Configuration', () => {
    test('has correct slug', () => {
      expect(Reviews.slug).toBe('reviews')
    })

    test('has correct admin configuration', () => {
      expect(Reviews.admin?.group).toBe('Platform Management')
      expect(Reviews.admin?.useAsTitle).toBe('comment')
    })

    test('has all required access control functions', () => {
      expect(Reviews.access?.read).toBeDefined()
      expect(Reviews.access?.create).toBeDefined()
      expect(Reviews.access?.update).toBeDefined()
      expect(Reviews.access?.delete).toBeDefined()
    })

    test('has rating calculation hooks', () => {
      expect(Reviews.hooks?.afterChange).toBeDefined()
      expect(Reviews.hooks?.afterDelete).toBeDefined()
    })
  })
})
