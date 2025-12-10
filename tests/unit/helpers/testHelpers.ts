/**
 * Test Helper Utilities
 *
 * Simple test utilities following existing project patterns.
 * Extends existing mock patterns from userProfileManagement.test.ts
 */

import type { Payload, PayloadRequest } from 'payload'
import { vi, expect } from 'vitest'
import type { mockUsers } from './mockUsers'

export type TestUser =
  | ReturnType<typeof mockUsers.platform>
  | ReturnType<typeof mockUsers.clinic>
  | ReturnType<typeof mockUsers.patient>
  | ReturnType<typeof mockUsers.anonymous>
  | PayloadRequest['user']
  | Record<string, unknown>
  | null
  | undefined

export type MockPayload = {
  find: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  logger: {
    level: string
    info: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
    debug: ReturnType<typeof vi.fn>
    fatal: ReturnType<typeof vi.fn>
    trace: ReturnType<typeof vi.fn>
  }
}

export type MockRequest = PayloadRequest & Record<string, unknown>

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
    level: 'info',
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  },
})

/**
 * Create a mock request object for access control testing
 * Follows the existing pattern from userProfileManagement.test.ts
 */
export const createMockReq = (
  user?: TestUser,
  payload?: MockPayload,
  overrides?: Partial<PayloadRequest>,
): MockRequest => {
  const effectivePayload = payload ?? createMockPayload()

  if (user && (user as { userType?: string }).userType === 'clinic' && !payload) {
    const clinicId =
      (user as { clinic?: number; clinicId?: number; id?: number | string }).clinic ??
      (user as { clinicId?: number; id?: number | string }).clinicId ??
      (user as { id?: number | string }).id
    effectivePayload.find.mockResolvedValue({
      docs: clinicId ? [{ clinic: clinicId, status: 'approved' }] : [],
    })
    effectivePayload.findByID.mockResolvedValue({ clinic: clinicId })
  }

  const baseReq: MockRequest = {
    user: (user ?? null) as PayloadRequest['user'],
    payload: effectivePayload as unknown as Payload,
    context: {},
    payloadAPI: 'local',
    payloadDataLoader: {} as unknown as PayloadRequest['payloadDataLoader'],
    headers: { get: () => undefined } as unknown as Headers,
    i18n: {} as unknown as PayloadRequest['i18n'],
    locale: 'en' as PayloadRequest['locale'],
    fallbackLocale: null,
    routeParams: {},
    url: '',
    method: 'GET',
    path: '',
    body: {},
    query: {},
  } as unknown as MockRequest

  return {
    ...baseReq,
    ...overrides,
    headers: (overrides?.headers as Headers | undefined) ?? baseReq.headers,
    payload: (overrides?.payload as Payload | undefined) ?? baseReq.payload,
    user: (overrides?.user as PayloadRequest['user'] | undefined) ?? baseReq.user,
  } as unknown as MockRequest
}

type AccessArgsBase = { req: PayloadRequest }

export type CreateAccessArgsOptions<T extends AccessArgsBase> = {
  payload?: MockPayload
  reqOverrides?: Partial<PayloadRequest>
  extra?: Omit<T, 'req'>
}

/**
 * Create access function arguments with user
 * For testing access control functions that expect { req: { user } }
 */
export const createAccessArgs = <T extends AccessArgsBase = { req: MockRequest }>(
  user?: TestUser,
  options?: CreateAccessArgsOptions<T>,
): T => {
  const req = createMockReq(user, options?.payload, options?.reqOverrides)
  const extra = options?.extra as Omit<T, 'req'> | undefined

  return {
    ...(extra ?? ({} as Omit<T, 'req'>)),
    req,
  } as T
}

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
