import { describe, test, expect, vi, beforeEach } from 'vitest'
import { Pages } from '@/collections/Pages'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

// Mock the scope filter functions
vi.mock('@/access/scopeFilters', () => ({
  platformOnlyOrPublished: vi.fn(),
}))

import { platformOnlyOrPublished } from '@/access/scopeFilters'

describe('Pages Collection Access Control', () => {
  const mockPlatformOnlyOrPublished = platformOnlyOrPublished as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Read Access', () => {
    test('uses platformOnlyOrPublished scope filter', () => {
      const req = createMockReq(mockUsers.platform())
      mockPlatformOnlyOrPublished.mockReturnValue(true)

      const result = Pages.access!.read!({ req } as any)

      expect(mockPlatformOnlyOrPublished).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })

    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        mockReturn: true,
        description: 'gets access to all pages including drafts',
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        mockReturn: { _status: { equals: 'published' } },
        description: 'gets access to published pages only',
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        mockReturn: { _status: { equals: 'published' } },
        description: 'gets access to published pages only',
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        mockReturn: { _status: { equals: 'published' } },
        description: 'gets access to published pages only',
      },
    ])('$userType $description', ({ user, mockReturn }) => {
      const req = createMockReq(user())
      mockPlatformOnlyOrPublished.mockReturnValue(mockReturn)

      const result = Pages.access!.read!({ req } as any)

      expect(result).toEqual(mockReturn)
    })
  })

  describe('Create Access', () => {
    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
    ])('$userType can create? $expected', ({ user, expected }) => {
      const req = createMockReq(user())
      const result = Pages.access!.create!({ req } as any)
      expect(result).toBe(expected)
    })
  })

  describe('Update Access', () => {
    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
    ])('$userType can update? $expected', ({ user, expected }) => {
      const req = createMockReq(user())
      const result = Pages.access!.update!({ req } as any)
      expect(result).toBe(expected)
    })
  })

  describe('Delete Access', () => {
    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
    ])('$userType can delete? $expected', ({ user, expected }) => {
      const req = createMockReq(user())
      const result = Pages.access!.delete!({ req } as any)
      expect(result).toBe(expected)
    })
  })
})
