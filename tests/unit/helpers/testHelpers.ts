/**
 * Test Helper Utilities
 *
 * Simple test utilities following existing project patterns.
 * Extends existing mock patterns from userProfileManagement.test.ts
 */

import type { Payload, PayloadRequest } from 'payload'
import { vi, expect } from 'vitest'
import type { Config } from '@/payload-types'
import type { mockUsers } from './mockUsers'

export type TestUser =
  | ReturnType<typeof mockUsers.platform>
  | ReturnType<typeof mockUsers.clinic>
  | ReturnType<typeof mockUsers.patient>
  | null
  | undefined

export type MockPayload = Pick<Payload, 'find' | 'findByID' | 'create' | 'update' | 'delete' | 'logger'>

export type MockRequest = Omit<Pick<PayloadRequest<Config['user']>, 'user' | 'payload' | 'context'>, 'payload'> & {
  payload: MockPayload
}

 /**
  * Create a mock Payload instance with common methods
  */
export const createMockPayload = (): MockPayload => ({
  find: vi.fn(),
  findByID: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
})

 /**
  * Create a mock request object for access control testing
  * Follows the existing pattern from userProfileManagement.test.ts
  */
export const createMockReq = (user?: TestUser, payload?: MockPayload): MockRequest => {
  const effectivePayload = payload ?? createMockPayload()

  if (user?.userType === 'clinic' && !payload) {
    const clinicId = user?.clinic ?? user?.clinicId ?? user?.id
    effectivePayload.find.mockResolvedValue({
      docs: clinicId ? [{ clinic: clinicId, status: 'approved' }] : [],
    })
    effectivePayload.findByID.mockResolvedValue({ clinic: clinicId })
  }

  return {
    user,
    payload: effectivePayload,
    context: {},
  }
}

 /**
  * Create access function arguments with user
  * For testing access control functions that expect { req: { user } }
  */
export const createAccessArgs = (user?: TestUser) => ({
  req: createMockReq(user),
})

 /**
  * Simple assertion utilities for access control testing
  */
export const expectAccess = {
  full: (result: unknown) => expect(result).toBe(true),
  none: (result: unknown) => expect(result).toBe(false),
  scoped: (result: unknown, expectedFilter: unknown) => expect(result).toEqual(expectedFilter),
}

/**
 * Mock cleanup utility - follows existing pattern from userProfileManagement.test.ts
 */
export const clearAllMocks = () => vi.clearAllMocks()
