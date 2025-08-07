import { describe, test, expect, vi, beforeEach } from 'vitest'
import { FavoriteClinics } from '@/collections/FavoriteClinics'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

// Mock the scope filter functions
vi.mock('@/access/scopeFilters', () => ({
  platformOrOwnPatientResource: vi.fn(),
}))

import { platformOrOwnPatientResource } from '@/access/scopeFilters'

describe('FavoriteClinics Collection Access Control', () => {
  const mockPlatformOrOwnPatientResource = platformOrOwnPatientResource as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Read Access', () => {
    test('uses platformOrOwnPatientResource scope filter', () => {
      const req = createMockReq(mockUsers.platform())
      mockPlatformOrOwnPatientResource.mockReturnValue(true)

      const result = FavoriteClinics.access!.read!({ req } as any)

      expect(mockPlatformOrOwnPatientResource).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })
  })

  describe('Create Access', () => {
    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
    ])('$userType can create? $expected', ({ user, expected }) => {
      const req = createMockReq(user())
      const result = FavoriteClinics.access!.create!({ req } as any)
      expect(result).toBe(expected)
    })
  })

  describe('Update Access', () => {
    test('uses platformOrOwnPatientResource', () => {
      const req = createMockReq(mockUsers.patient())
      mockPlatformOrOwnPatientResource.mockReturnValue({ patient: { equals: 3 } })

      const result = FavoriteClinics.access!.update!({ req } as any)

      expect(mockPlatformOrOwnPatientResource).toHaveBeenCalledWith({ req })
      expect(result).toEqual({ patient: { equals: 3 } })
    })
  })

  describe('Delete Access', () => {
    test('uses platformOrOwnPatientResource', () => {
      const req = createMockReq(mockUsers.platform())
      mockPlatformOrOwnPatientResource.mockReturnValue(true)

      const result = FavoriteClinics.access!.delete!({ req } as any)

      expect(mockPlatformOrOwnPatientResource).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })
  })
})
