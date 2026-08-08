import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Review } from '@/payload-types'
import { reviewPublicationHistoryGetHandler } from '@/collections/reviews/endpoints'

const clinicAssignmentMocks = vi.hoisted(() => ({
  getUserAssignedClinicId: vi.fn(async () => 7 as number | null),
}))

vi.mock('@/access/utils/getClinicAssignment', () => clinicAssignmentMocks)

const REVIEW_REVISION = '2026-08-08T10:00:00.000Z'

const platformUser = { collection: 'platformStaff', id: 11 } as const
const clinicUser = { collection: 'clinicStaff', id: 12 } as const
const patientUser = { collection: 'patients', id: 13 } as const

const currentReview = (overrides: Partial<Review> = {}): Review =>
  ({
    id: 42,
    clinic: 7,
    comment: 'Care was excellent.',
    publicAuthorName: 'Maya K.',
    publicMeasure: 'none',
    publicNotice: null,
    publicComment: null,
    reviewDate: '2026-08-01T00:00:00.000Z',
    starRating: 5,
    status: 'approved',
    updatedAt: REVIEW_REVISION,
    withdrawalSource: null,
    withdrawalState: 'active',
    withdrawnAt: null,
    ...overrides,
  }) as Review

const versionRecord = (id: number, secondsBeforeRevision: number) => {
  const createdAt = new Date(Date.parse(REVIEW_REVISION) - secondsBeforeRevision * 1000).toISOString()
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    version: currentReview({ updatedAt: createdAt }),
  }
}

const createHarness = ({
  review = currentReview(),
  versionDocs = [],
}: {
  review?: Review | null
  versionDocs?: Array<ReturnType<typeof versionRecord>>
} = {}) => {
  const findByID = vi.fn(async (_args: unknown) => review)
  const findVersions = vi.fn(async (_args: unknown) => ({ docs: versionDocs }))
  const logger = { error: vi.fn() }
  const payload = { findByID, findVersions, logger }

  const request = ({
    query = '',
    routeId = 42,
    user = platformUser as unknown,
  }: {
    query?: string
    routeId?: number | string
    user?: unknown
  } = {}) =>
    ({
      payload,
      routeParams: { id: routeId },
      searchParams: new URLSearchParams(query),
      user,
    }) as unknown as PayloadRequest

  return { findByID, findVersions, logger, payload, request }
}

const responseData = async (response: Response) =>
  (await response.json()) as {
    data: {
      pagination: { hasNextPage: boolean; limit: number; nextCursor: string | null }
      reviewId: number | string
      versions: Array<{ id: number | string | null }>
    }
  }

const decodeCursor = (cursor: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>

const encodeCursor = (cursor: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')

beforeEach(() => {
  vi.clearAllMocks()
  clinicAssignmentMocks.getUserAssignedClinicId.mockResolvedValue(7)
})

describe('review publication history pagination', () => {
  it.each([
    { expectedInternalLimit: 26, expectedLimit: 25, query: '', versionCount: 26 },
    { expectedInternalLimit: 101, expectedLimit: 100, query: 'limit=100', versionCount: 101 },
  ])(
    'bounds $expectedLimit returned versions with one-record lookahead',
    async ({ expectedInternalLimit, expectedLimit, query, versionCount }) => {
      const records = Array.from({ length: versionCount }, (_, index) => versionRecord(versionCount - index, index))
      const { findVersions, request } = createHarness({ versionDocs: records })

      const response = await reviewPublicationHistoryGetHandler(request({ query }))

      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toContain('private, no-store')
      const body = await responseData(response)
      expect(body.data.versions).toHaveLength(expectedLimit)
      expect(body.data.pagination).toMatchObject({
        limit: expectedLimit,
        hasNextPage: true,
      })
      expect(body.data.pagination.nextCursor).toEqual(expect.any(String))
      expect(findVersions).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'reviews',
          limit: expectedInternalLimit,
          pagination: false,
          sort: ['-createdAt', '-id'],
        }),
      )
      expect(findVersions.mock.calls[0]?.[0]).not.toHaveProperty('page')
    },
  )

  it('walks stable keyset pages without overlap or gaps and ends with a null cursor', async () => {
    const records = [
      versionRecord(105, 0),
      versionRecord(104, 1),
      versionRecord(103, 2),
      versionRecord(102, 3),
      versionRecord(101, 4),
    ]
    const { findVersions, request } = createHarness()
    findVersions
      .mockResolvedValueOnce({ docs: records.slice(0, 3) })
      .mockResolvedValueOnce({ docs: records.slice(2, 5) })
      .mockResolvedValueOnce({ docs: records.slice(4, 5) })

    const first = await responseData(await reviewPublicationHistoryGetHandler(request({ query: 'limit=2' })))
    const second = await responseData(
      await reviewPublicationHistoryGetHandler(
        request({ query: `limit=2&cursor=${encodeURIComponent(String(first.data.pagination.nextCursor))}` }),
      ),
    )
    const third = await responseData(
      await reviewPublicationHistoryGetHandler(
        request({ query: `limit=2&cursor=${encodeURIComponent(String(second.data.pagination.nextCursor))}` }),
      ),
    )

    const deliveredIds = [...first.data.versions, ...second.data.versions, ...third.data.versions].map(
      (version) => version.id,
    )
    expect(deliveredIds).toEqual([105, 104, 103, 102, 101])
    expect(new Set(deliveredIds).size).toBe(deliveredIds.length)
    expect(third.data.pagination).toEqual({ limit: 2, hasNextPage: false, nextCursor: null })

    const firstCursor = decodeCursor(String(first.data.pagination.nextCursor))
    expect(findVersions.mock.calls[1]?.[0]).toMatchObject({
      limit: 3,
      pagination: false,
      sort: ['-createdAt', '-id'],
      where: {
        and: [
          { parent: { equals: 42 } },
          {
            or: [
              { createdAt: { less_than: firstCursor.createdAt } },
              {
                and: [{ createdAt: { equals: firstCursor.createdAt } }, { id: { less_than: firstCursor.id } }],
              },
            ],
          },
        ],
      },
    })
  })

  it('returns HISTORY_CHANGED when the review revision changes after issuing a cursor', async () => {
    const { findByID, findVersions, request } = createHarness({
      versionDocs: [versionRecord(3, 0), versionRecord(2, 1)],
    })
    const first = await responseData(await reviewPublicationHistoryGetHandler(request({ query: 'limit=1' })))
    findByID.mockResolvedValueOnce(currentReview({ updatedAt: '2026-08-08T10:01:00.000Z' }))
    findVersions.mockClear()

    const response = await reviewPublicationHistoryGetHandler(
      request({ query: `limit=1&cursor=${encodeURIComponent(String(first.data.pagination.nextCursor))}` }),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: { code: 'HISTORY_CHANGED' } })
    expect(findVersions).not.toHaveBeenCalled()
  })

  it('rejects unknown, repeated, out-of-range, decimal, malformed, and foreign inputs', async () => {
    const validCursor = {
      version: 1,
      reviewId: 42,
      reviewRevision: REVIEW_REVISION,
      createdAt: '2026-08-08T09:59:59.000Z',
      id: 41,
    }
    const malformedShape = encodeCursor({ ...validCursor, unexpected: true })
    const foreignCursor = encodeCursor({ ...validCursor, reviewId: 999 })
    const unsupportedVersion = encodeCursor({ ...validCursor, version: 2 })
    const { findVersions, request } = createHarness()
    const queries = [
      'unknown=true',
      'limit=1&limit=1',
      `cursor=${encodeURIComponent(encodeCursor(validCursor))}&cursor=${encodeURIComponent(encodeCursor(validCursor))}`,
      'limit=0',
      'limit=101',
      'limit=1.5',
      'cursor=not.base64url',
      `cursor=${'a'.repeat(2049)}`,
      `cursor=${encodeURIComponent(`${encodeCursor(validCursor)}=`)}`,
      `cursor=${encodeURIComponent(malformedShape)}`,
      `cursor=${encodeURIComponent(unsupportedVersion)}`,
      `cursor=${encodeURIComponent(foreignCursor)}`,
    ]

    for (const query of queries) {
      const response = await reviewPublicationHistoryGetHandler(request({ query }))
      expect(response.status, query).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: { code: 'INVALID_INPUT' } })
    }

    expect(findVersions).not.toHaveBeenCalled()
  })

  it('authorizes and hides tenant state before validating query input', async () => {
    const anonymous = createHarness()
    expect(
      (await reviewPublicationHistoryGetHandler(anonymous.request({ query: 'unknown=true', user: null }))).status,
    ).toBe(401)
    expect(anonymous.findByID).not.toHaveBeenCalled()

    const wrongRole = createHarness()
    expect(
      (await reviewPublicationHistoryGetHandler(wrongRole.request({ query: 'unknown=true', user: patientUser })))
        .status,
    ).toBe(403)
    expect(wrongRole.findByID).not.toHaveBeenCalled()

    const missing = createHarness({ review: null })
    expect((await reviewPublicationHistoryGetHandler(missing.request({ query: 'unknown=true' }))).status).toBe(404)

    clinicAssignmentMocks.getUserAssignedClinicId.mockResolvedValueOnce(99)
    const foreignTenant = createHarness()
    expect(
      (await reviewPublicationHistoryGetHandler(foreignTenant.request({ query: 'unknown=true', user: clinicUser })))
        .status,
    ).toBe(404)
    expect(foreignTenant.findVersions).not.toHaveBeenCalled()

    const pending = createHarness({ review: currentReview({ status: 'pending' }) })
    expect(
      (await reviewPublicationHistoryGetHandler(pending.request({ query: 'unknown=true', user: clinicUser }))).status,
    ).toBe(404)
    expect(pending.findVersions).not.toHaveBeenCalled()

    const deleted = createHarness({ review: currentReview({ deletedAt: '2026-08-08T10:02:00.000Z' }) })
    expect(
      (await reviewPublicationHistoryGetHandler(deleted.request({ query: 'unknown=true', user: clinicUser }))).status,
    ).toBe(404)
    expect(deleted.findVersions).not.toHaveBeenCalled()
  })

  it('maps history infrastructure failures to UNAVAILABLE', async () => {
    const { findVersions, logger, request } = createHarness()
    findVersions.mockRejectedValueOnce(new Error('database unavailable'))

    const response = await reviewPublicationHistoryGetHandler(request())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: { code: 'UNAVAILABLE' } })
    expect(logger.error).toHaveBeenCalledOnce()
  })
})
