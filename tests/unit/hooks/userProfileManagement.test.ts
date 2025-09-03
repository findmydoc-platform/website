import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUserProfileHook } from '../../../src/hooks/userProfileManagement'

// Mock payload and req objects
const mockPayload = {
  find: vi.fn(),
  create: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}

const mockReq = {
  payload: mockPayload,
  context: {},
} as any

describe('userProfileManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createUserProfileHook', () => {
    it('should skip profile creation when operation is not create', async () => {
      const doc = { id: 'user1', userType: 'clinic' } as any

      const result = await createUserProfileHook({
        doc,
        operation: 'update',
        req: mockReq,
      } as any)

      expect(result).toBe(doc)
      expect(mockPayload.create).not.toHaveBeenCalled()
    })

    it('should skip profile creation when skipProfileCreation context is set', async () => {
      const doc = { id: 'user1', userType: 'clinic' } as any
      const reqWithSkip = {
        ...mockReq,
        context: { skipProfileCreation: true },
      }

      const result = await createUserProfileHook({
        doc,
        operation: 'create',
        req: reqWithSkip,
      } as any)

      expect(result).toBe(doc)
      expect(mockPayload.create).not.toHaveBeenCalled()
    })

    it('should create clinic staff profile for clinic user and copy email', async () => {
      const doc = { id: 'user1', userType: 'clinic', email: 'clinic@example.com' } as any

      // Mock no existing profile
      mockPayload.find.mockResolvedValue({ docs: [] })

      // Mock successful profile creation
      mockPayload.create.mockResolvedValue({ id: 'profile1' })

      const result = await createUserProfileHook({
        doc,
        operation: 'create',
        req: mockReq,
      } as any)

      expect(result).toBe(doc)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'clinicStaff',
        where: { user: { equals: 'user1' } },
        limit: 1,
        req: mockReq,
      })
      expect(mockPayload.create).toHaveBeenCalledWith({
        collection: 'clinicStaff',
        data: {
          user: 'user1',
          email: 'clinic@example.com',
          status: 'pending',
        },
        req: mockReq,
        overrideAccess: true,
      })
    })

    it('should create platform staff profile for platform user', async () => {
      const doc = { id: 'user1', userType: 'platform' } as any

      // Mock no existing profile
      mockPayload.find.mockResolvedValue({ docs: [] })

      // Mock successful profile creation
      mockPayload.create.mockResolvedValue({ id: 'profile1' })

      const result = await createUserProfileHook({
        doc,
        operation: 'create',
        req: mockReq,
      } as any)

      expect(result).toBe(doc)
      expect(mockPayload.create).toHaveBeenCalledWith({
        collection: 'platformStaff',
        data: {
          user: 'user1',
          role: 'admin',
        },
        req: mockReq,
        overrideAccess: true,
      })
    })

    it('should skip profile creation if profile already exists', async () => {
      const doc = { id: 'user1', userType: 'clinic' } as any

      // Mock existing profile
      mockPayload.find.mockResolvedValue({ docs: [{ id: 'existingProfile' }] })

      const result = await createUserProfileHook({
        doc,
        operation: 'create',
        req: mockReq,
      } as any)

      expect(result).toBe(doc)
      expect(mockPayload.create).not.toHaveBeenCalled()
      expect(mockPayload.logger.info).toHaveBeenCalledWith('Profile already exists for clinic user: user1')
    })

    it('should handle profile creation errors gracefully', async () => {
      const doc = { id: 'user1', userType: 'clinic' } as any

      // Mock no existing profile
      mockPayload.find.mockResolvedValue({ docs: [] })

      // Mock profile creation failure
      const error = new Error('Profile creation failed')
      mockPayload.create.mockRejectedValue(error)

      const result = await createUserProfileHook({
        doc,
        operation: 'create',
        req: mockReq,
      } as any)

      expect(result).toBe(doc)
      expect(mockPayload.logger.error).toHaveBeenCalledWith(
        'Failed to create clinic profile for user: user1',
        expect.objectContaining({
          error: 'Profile creation failed',
          userType: 'clinic',
          collection: 'clinicStaff',
        }),
      )
    })

    it('should not create profile for patient users', async () => {
      const doc = { id: 'user1', userType: 'patient' } as any

      const result = await createUserProfileHook({
        doc,
        operation: 'create',
        req: mockReq,
      } as any)

      expect(result).toBe(doc)
      expect(mockPayload.find).not.toHaveBeenCalled()
      expect(mockPayload.create).not.toHaveBeenCalled()
    })
  })
})
