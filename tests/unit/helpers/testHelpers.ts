/**
 * Test Helper Utilities
 *
 * Simple test utilities following existing project patterns.
 * Extends existing mock patterns from userProfileManagement.test.ts
 */

import { vi, expect } from 'vitest'

/**
 * Create a mock Payload instance with common methods
 */
export const createMockPayload = () => ({
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
export const createMockReq = (user?: any, payload = createMockPayload()) => {
  if (user?.userType === 'clinic') {
    const clinicId = user?.clinic ?? user?.clinicId ?? user?.id
    payload.find.mockResolvedValue({
      docs: clinicId ? [{ clinic: clinicId, status: 'approved' }] : [],
    })
    payload.findByID.mockResolvedValue({ clinic: clinicId })
  }

  return {
    user,
    payload,
    context: {},
  } as any
}

/**
 * Create access function arguments with user
 * For testing access control functions that expect { req: { user } }
 */
export const createAccessArgs = (user?: any) =>
  ({
    req: { user },
  }) as any

/**
 * Simple assertion utilities for access control testing
 */
export const expectAccess = {
  full: (result: any) => expect(result).toBe(true),
  none: (result: any) => expect(result).toBe(false),
  scoped: (result: any, expectedFilter: any) => expect(result).toEqual(expectedFilter),
}

/**
 * Mock cleanup utility - follows existing pattern from userProfileManagement.test.ts
 */
export const clearAllMocks = () => vi.clearAllMocks()
