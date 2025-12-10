import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUserProfileHook } from '@/collections/BasicUsers/hooks/createUserProfile'
import type { PaginatedDocs, SanitizedCollectionConfig } from 'payload'
import type { BasicUser } from '@/payload-types'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

// Mock payload and req objects
const mockPayload = createMockPayload()
const mockReq = createMockReq(undefined, mockPayload)

const mockCollection = { slug: 'basicUsers' } as unknown as SanitizedCollectionConfig

const paginated = <T>(docs: T[]): PaginatedDocs<T> => ({
  docs,
  hasNextPage: false,
  hasPrevPage: false,
  limit: docs.length,
  nextPage: null,
  page: 1,
  pagingCounter: 1,
  prevPage: null,
  totalDocs: docs.length,
  totalPages: 1,
})

const makeUser = (overrides: Partial<BasicUser>): BasicUser => ({
  id: 1,
  userType: 'clinic',
  email: 'user@example.com',
  firstName: 'First',
  lastName: 'Last',
  createdAt: '2023-01-01',
  updatedAt: '2023-01-02',
  ...overrides,
})

describe('userProfileManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createUserProfileHook', () => {
    it('should skip profile creation when operation is not create', async () => {
      const doc = makeUser({ id: 1, userType: 'clinic' })

      const result = await createUserProfileHook({
        doc,
        data: doc,
        previousDoc: doc,
        operation: 'update',
        req: mockReq,
        context: {},
        collection: mockCollection,
      })

      expect(result).toBe(doc)
      expect(mockPayload.create).not.toHaveBeenCalled()
    })

    it('should skip profile creation when skipProfileCreation context is set', async () => {
      const doc = makeUser({ id: 1, userType: 'clinic' })
      const reqWithSkip = createMockReq(undefined, mockPayload, { context: { skipProfileCreation: true } })

      const result = await createUserProfileHook({
        doc,
        data: doc,
        previousDoc: doc,
        operation: 'create',
        req: reqWithSkip,
        context: reqWithSkip.context,
        collection: mockCollection,
      })

      expect(result).toBe(doc)
      expect(mockPayload.create).not.toHaveBeenCalled()
    })

    it('should create clinic staff profile for clinic user and copy email', async () => {
      const doc = makeUser({ id: 1, userType: 'clinic', email: 'clinic@example.com' })

      // Mock no existing profile
      vi.mocked(mockPayload.find).mockResolvedValue(paginated([]))

      // Mock successful profile creation
      vi.mocked(mockPayload.create).mockResolvedValue({ id: 101, createdAt: '', updatedAt: '' })

      const result = await createUserProfileHook({
        doc,
        data: doc,
        previousDoc: doc,
        operation: 'create',
        req: mockReq,
        context: {},
        collection: mockCollection,
      })

      expect(result).toBe(doc)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'clinicStaff',
        where: { user: { equals: 1 } },
        limit: 1,
        req: mockReq,
      })
      expect(mockPayload.create).toHaveBeenCalledWith({
        collection: 'clinicStaff',
        data: {
          user: 1,
          status: 'pending',
        },
        req: mockReq,
        overrideAccess: true,
        draft: false,
      })
    })

    it('should create platform staff profile for platform user', async () => {
      const doc = makeUser({ id: 2, userType: 'platform' })

      // Mock no existing profile
      vi.mocked(mockPayload.find).mockResolvedValue(paginated([]))

      // Mock successful profile creation
      vi.mocked(mockPayload.create).mockResolvedValue({ id: 202 })

      const result = await createUserProfileHook({
        doc,
        data: doc,
        previousDoc: doc,
        operation: 'create',
        req: mockReq,
        context: {},
        collection: mockCollection,
      })

      expect(result).toBe(doc)
      expect(mockPayload.create).toHaveBeenCalledWith({
        collection: 'platformStaff',
        data: {
          user: 2,
          role: 'admin',
        },
        req: mockReq,
        overrideAccess: true,
        draft: false,
      })
    })

    it('should skip profile creation if profile already exists', async () => {
      const doc = makeUser({ id: 3, userType: 'clinic' })

      // Mock existing profile
      vi.mocked(mockPayload.find).mockResolvedValue(paginated([{ id: 303, user: 3, createdAt: '', updatedAt: '' }]))

      const result = await createUserProfileHook({
        doc,
        data: doc,
        previousDoc: doc,
        operation: 'create',
        req: mockReq,
        context: {},
        collection: mockCollection,
      })

      expect(result).toBe(doc)
      expect(mockPayload.create).not.toHaveBeenCalled()
      expect(mockPayload.logger.info).toHaveBeenCalledWith('Profile already exists for clinic user: 3')
    })

    it('should handle profile creation errors gracefully', async () => {
      const doc = makeUser({ id: 4, userType: 'clinic' })

      // Mock no existing profile
      vi.mocked(mockPayload.find).mockResolvedValue(paginated([]))

      // Mock profile creation failure
      const error = new Error('Profile creation failed')
      vi.mocked(mockPayload.create).mockRejectedValue(error)

      const result = await createUserProfileHook({
        doc,
        data: doc,
        previousDoc: doc,
        operation: 'create',
        req: mockReq,
        context: {},
        collection: mockCollection,
      })

      expect(result).toBe(doc)
      expect(mockPayload.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Profile creation failed',
          userType: 'clinic',
          collection: 'clinicStaff',
        }),
        'Failed to create clinic profile for user: 4',
      )
    })
  })
})
