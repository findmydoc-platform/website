import type { PayloadRequest } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMockPayload, createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

const { getSnapshotMock } = vi.hoisted(() => ({
  getSnapshotMock: vi.fn(),
}))

vi.mock('@/utilities/cacheRevalidation/visibility', () => ({
  getCacheRevalidationVisibilitySnapshot: getSnapshotMock,
}))

import { cacheRevalidationVisibilityGetHandler } from '@/endpoints/cacheRevalidationVisibility'

type MockResponse = {
  _status?: number
  _body: Record<string, unknown>
  status: (code: number) => MockResponse
  json: (body: unknown) => MockResponse
}

const makeRes = (): MockResponse => {
  const res: Partial<MockResponse> = {
    _status: 0,
    _body: {},
    status: (code: number) => {
      res._status = code
      return res as MockResponse
    },
    json: (body: unknown) => {
      res._body = body as Record<string, unknown>
      return res as MockResponse
    },
  }
  return res as MockResponse
}

const createReq = (args: {
  user: PayloadRequest['user'] | Record<string, unknown> | null
  role?: 'admin' | 'support' | 'content-manager'
  rejectLookup?: boolean
}) => {
  const payload = createMockPayload()
  if (args.rejectLookup) {
    payload.find.mockRejectedValue(new Error('database unavailable with raw details'))
  } else if (args.role) {
    payload.find.mockResolvedValue({
      docs: [{ id: 'profile-1', role: args.role }],
    })
  } else {
    payload.find.mockResolvedValue({ docs: [] })
  }

  return {
    payload,
    req: createMockReq(args.user, payload, { method: 'GET' }) as PayloadRequest,
  }
}

describe('cacheRevalidationVisibilityGetHandler', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it.each(['admin', 'support'] as const)('allows platform %s staff after role lookup', async (role) => {
    const { payload, req } = createReq({ user: mockUsers.platform(123), role })
    getSnapshotMock.mockReturnValue({
      limit: 200,
      count: 1,
      totalRecorded: 1,
      droppedOldestCount: 0,
      events: [{ id: 'event-1' }],
    })
    const res = makeRes()

    await cacheRevalidationVisibilityGetHandler(req, res)

    expect(res._status).toBe(200)
    expect(res._body).toMatchObject({
      limit: 200,
      count: 1,
      events: [{ id: 'event-1' }],
    })
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'platformStaff',
        depth: 0,
        limit: 1,
        pagination: false,
        where: {
          and: [
            { id: { equals: 123 } },
            {
              role: {
                in: ['admin', 'support'],
              },
            },
          ],
        },
      }),
    )
    expect(getSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['platform content manager', mockUsers.platform(1), 'content-manager' as const],
    ['platform user without profile', mockUsers.platform(1), undefined],
    ['platform user without id', { collection: 'platformStaff' }, undefined],
    ['clinic user', mockUsers.clinic(), undefined],
    ['patient user', mockUsers.patient(), undefined],
    ['anonymous user', mockUsers.anonymous(), undefined],
  ])('denies %s without reading history', async (_label, user, role) => {
    const { payload, req } = createReq({ user, role })
    const res = makeRes()

    await cacheRevalidationVisibilityGetHandler(req, res)

    expect(res._status).toBe(403)
    expect(res._body).toEqual({ error: 'Access denied' })
    expect(getSnapshotMock).not.toHaveBeenCalled()

    if (user && (user as { collection?: unknown; id?: unknown }).collection === 'platformStaff' && 'id' in user) {
      expect(payload.find).toHaveBeenCalledTimes(1)
    } else {
      expect(payload.find).not.toHaveBeenCalled()
    }
  })

  it('fails closed and logs redacted lookup failures before reading history', async () => {
    const { payload, req } = createReq({
      user: mockUsers.platform(123),
      rejectLookup: true,
    })
    const res = makeRes()

    await cacheRevalidationVisibilityGetHandler(req, res)

    expect(res._status).toBe(403)
    expect(getSnapshotMock).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith(
      {
        event: 'cache.revalidation.visibility.access_lookup_failed',
        scope: 'cache-revalidation.visibility',
        errorType: 'Error',
      },
      'Unable to resolve cache revalidation visibility access',
    )
    expect(JSON.stringify(vi.mocked(payload.logger.warn).mock.calls)).not.toContain('database unavailable')
  })
})
