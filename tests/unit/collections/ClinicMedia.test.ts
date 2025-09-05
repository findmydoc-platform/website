import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ClinicMedia } from '@/collections/ClinicMedia'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

// Mock the scope filter functions
vi.mock('@/access/scopeFilters', () => ({
  platformOrOwnClinicResource: vi.fn(),
}))

// Mock the anyone access function
vi.mock('@/access/anyone', () => ({
  anyone: vi.fn(),
}))

import { platformOrOwnClinicResource } from '@/access/scopeFilters'
import { anyone } from '@/access/anyone'

describe('ClinicMedia Collection Access Control', () => {
  const mockPlatformOrOwnClinicResource = platformOrOwnClinicResource as any
  const mockAnyone = anyone as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Read Access', () => {
    test('uses anyone access (public read)', () => {
      const req = createMockReq(mockUsers.anonymous())
      mockAnyone.mockReturnValue(true)

      const result = ClinicMedia.access!.read!({ req } as any)

      expect(mockAnyone).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })

    test.each([
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        description: 'has public read access'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        description: 'has public read access'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        description: 'has public read access'
      },
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        description: 'has public read access'
      }
    ])('$userType $description', ({ user }) => {
      const req = createMockReq(user())
      mockAnyone.mockReturnValue(true)

      const result = ClinicMedia.access!.read!({ req } as any)

      expect(result).toBe(true)
    })
  })

  describe('Create Access', () => {
    test('uses platformOrOwnClinicResource scope filter', () => {
      const req = createMockReq(mockUsers.platform())
      mockPlatformOrOwnClinicResource.mockReturnValue(true)

      const result = ClinicMedia.access!.create!({ req } as any)

      expect(mockPlatformOrOwnClinicResource).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })

    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        mockReturn: true,
        description: 'can create clinic media for any clinic'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        mockReturn: { clinic: { equals: 1 } },
        description: 'can create clinic media only for their assigned clinic'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        mockReturn: false,
        description: 'cannot create clinic media'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        mockReturn: false,
        description: 'cannot create clinic media'
      }
    ])('$userType $description', ({ user, mockReturn }) => {
      const req = createMockReq(user())
      mockPlatformOrOwnClinicResource.mockReturnValue(mockReturn)

      const result = ClinicMedia.access!.create!({ req } as any)

      expect(result).toEqual(mockReturn)
    })
  })

  describe('Update Access', () => {
    test('uses platformOrOwnClinicResource scope filter', () => {
      const req = createMockReq(mockUsers.platform())
      mockPlatformOrOwnClinicResource.mockReturnValue(true)

      const result = ClinicMedia.access!.update!({ req } as any)

      expect(mockPlatformOrOwnClinicResource).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })

    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        mockReturn: true,
        description: 'can update all clinic media'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        mockReturn: { clinic: { equals: 1 } },
        description: 'can update clinic media only for their assigned clinic'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        mockReturn: false,
        description: 'cannot update clinic media'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        mockReturn: false,
        description: 'cannot update clinic media'
      }
    ])('$userType $description', ({ user, mockReturn }) => {
      const req = createMockReq(user())
      mockPlatformOrOwnClinicResource.mockReturnValue(mockReturn)

      const result = ClinicMedia.access!.update!({ req } as any)

      expect(result).toEqual(mockReturn)
    })
  })

  describe('Delete Access', () => {
    test('uses platformOrOwnClinicResource scope filter', () => {
      const req = createMockReq(mockUsers.platform())
      mockPlatformOrOwnClinicResource.mockReturnValue(true)

      const result = ClinicMedia.access!.delete!({ req } as any)

      expect(mockPlatformOrOwnClinicResource).toHaveBeenCalledWith({ req })
      expect(result).toBe(true)
    })

    test.each([
      {
        userType: 'Platform Staff',
        user: () => mockUsers.platform(),
        mockReturn: true,
        description: 'can delete all clinic media'
      },
      {
        userType: 'Clinic Staff',
        user: () => mockUsers.clinic(),
        mockReturn: { clinic: { equals: 1 } },
        description: 'can delete clinic media only for their assigned clinic'
      },
      {
        userType: 'Patient',
        user: () => mockUsers.patient(),
        mockReturn: false,
        description: 'cannot delete clinic media'
      },
      {
        userType: 'Anonymous',
        user: () => mockUsers.anonymous(),
        mockReturn: false,
        description: 'cannot delete clinic media'
      }
    ])('$userType $description', ({ user, mockReturn }) => {
      const req = createMockReq(user())
      mockPlatformOrOwnClinicResource.mockReturnValue(mockReturn)

      const result = ClinicMedia.access!.delete!({ req } as any)

      expect(result).toEqual(mockReturn)
    })
  })

  describe('Collection Configuration', () => {
    test('has correct slug', () => {
      expect(ClinicMedia.slug).toBe('clinicMedia')
    })

    test('has correct admin configuration', () => {
      expect(ClinicMedia.admin?.group).toBe('Content & Media')
      expect(ClinicMedia.admin?.useAsTitle).toBe('alt')
      expect(ClinicMedia.admin?.description).toBe('Media files uploaded and managed by clinics for their own use')
    })

    test('has upload configuration', () => {
      expect(ClinicMedia.upload).toBeDefined()
      expect(ClinicMedia.upload?.adminThumbnail).toBe('thumbnail')
      expect(ClinicMedia.upload?.focalPoint).toBe(true)
      expect(ClinicMedia.upload?.imageSizes).toBeDefined()
      expect(ClinicMedia.upload?.imageSizes?.length).toBeGreaterThan(0)
    })

    test('has all required access control functions', () => {
      expect(ClinicMedia.access?.read).toBeDefined()
      expect(ClinicMedia.access?.create).toBeDefined()
      expect(ClinicMedia.access?.update).toBeDefined()
      expect(ClinicMedia.access?.delete).toBeDefined()
    })

    test('read access uses anyone function', () => {
      expect(ClinicMedia.access?.read).toBe(anyone)
    })

    test('create access uses platformOrOwnClinicResource scope filter', () => {
      expect(ClinicMedia.access?.create).toBe(platformOrOwnClinicResource)
    })

    test('update access uses platformOrOwnClinicResource scope filter', () => {
      expect(ClinicMedia.access?.update).toBe(platformOrOwnClinicResource)
    })

    test('delete access uses platformOrOwnClinicResource scope filter', () => {
      expect(ClinicMedia.access?.delete).toBe(platformOrOwnClinicResource)
    })
  })

  describe('Field Configuration', () => {
    test('has required alt field', () => {
      const altField = ClinicMedia.fields.find(field => 'name' in field && field.name === 'alt')
      expect(altField).toBeDefined()
      expect((altField as any)?.type).toBe('text')
      expect((altField as any)?.required).toBe(true)
    })

    test('has optional caption field with richText type', () => {
      const captionField = ClinicMedia.fields.find(field => 'name' in field && field.name === 'caption')
      expect(captionField).toBeDefined()
      expect((captionField as any)?.type).toBe('richText')
      expect((captionField as any)?.required).toBeFalsy()
    })

    test('has required clinic relationship field with index', () => {
      const clinicField = ClinicMedia.fields.find(field => 'name' in field && field.name === 'clinic')
      expect(clinicField).toBeDefined()
      expect((clinicField as any)?.type).toBe('relationship')
      expect((clinicField as any)?.relationTo).toBe('clinics')
      expect((clinicField as any)?.required).toBe(true)
      expect((clinicField as any)?.index).toBe(true)
    })

    test('has hidden prefix field', () => {
      const prefixField = ClinicMedia.fields.find(field => 'name' in field && field.name === 'prefix')
      expect(prefixField).toBeDefined()
      expect((prefixField as any)?.type).toBe('text')
      expect((prefixField as any)?.admin?.readOnly).toBe(true)
      expect((prefixField as any)?.admin?.hidden).toBe(true)
    })
  })
})