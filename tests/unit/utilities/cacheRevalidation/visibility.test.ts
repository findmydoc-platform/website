import { revalidatePath, revalidateTag } from 'next/cache'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CACHE_REVALIDATION_VISIBILITY_LIMIT,
  CACHE_REVALIDATION_VISIBILITY_PREVIEW_LIMIT,
  executeRevalidationPlan,
  getCacheRevalidationVisibilitySnapshot,
  recordCacheRevalidationVisibilityFromLogPayload,
  REVALIDATION_LOG_EVENTS,
  resetCacheRevalidationVisibilityForTests,
  type RevalidationPlan,
} from '@/utilities/cacheRevalidation'

const createPayload = (index: number) => ({
  event: REVALIDATION_LOG_EVENTS.planned,
  operation: 'update',
  source: { kind: 'payload-hook', id: `source-${index}` },
  subject: { kind: 'collection', id: `subject-${index}`, collection: 'posts' },
  cacheClasses: ['aggregated-public'],
  surfaceIds: ['posts-list'],
  tagCount: 1,
  pathCount: 1,
  tagsPreview: [`collection:posts:${index}`],
  pathsPreview: ['/posts'],
  tagsTruncated: false,
  pathsTruncated: false,
})

const createPlan = (): RevalidationPlan => ({
  operation: 'update',
  source: { kind: 'test', id: 'visibility-test' },
  subject: { kind: 'posts-list' },
  cacheClasses: ['aggregated-public'],
  surfaceIds: ['posts-list'],
  tags: ['collection:posts'],
  paths: ['/posts'],
  logContext: {
    operation: 'update',
    sourceKind: 'test',
    sourceId: 'visibility-test',
    subjectKind: 'posts-list',
    cacheClasses: ['aggregated-public'],
    surfaceIds: ['posts-list'],
    tagCount: 1,
    pathCount: 1,
  },
})

const resetNextCacheMocks = () => {
  vi.mocked(revalidateTag).mockReset()
  vi.mocked(revalidatePath).mockReset()
  vi.mocked(revalidateTag).mockImplementation(() => undefined)
  vi.mocked(revalidatePath).mockImplementation(() => undefined)
}

describe('cache revalidation visibility', () => {
  afterEach(() => {
    resetCacheRevalidationVisibilityForTests()
    resetNextCacheMocks()
  })

  it('keeps a bounded newest-first ring buffer', () => {
    for (let index = 0; index < CACHE_REVALIDATION_VISIBILITY_LIMIT + 3; index += 1) {
      recordCacheRevalidationVisibilityFromLogPayload(createPayload(index), () => `2026-07-08T10:00:${index}.000Z`)
    }

    const snapshot = getCacheRevalidationVisibilitySnapshot()

    expect(snapshot).toMatchObject({
      limit: CACHE_REVALIDATION_VISIBILITY_LIMIT,
      count: CACHE_REVALIDATION_VISIBILITY_LIMIT,
      totalRecorded: CACHE_REVALIDATION_VISIBILITY_LIMIT + 3,
      droppedOldestCount: 3,
    })
    expect(snapshot.events[0]?.source.id).toBe(`source-${CACHE_REVALIDATION_VISIBILITY_LIMIT + 2}`)
    expect(snapshot.events.at(-1)?.source.id).toBe('source-3')
  })

  it('caps previews and stores only redacted failure summaries', () => {
    const rawDoc = { marker: 'raw-doc-marker' }
    const rawStack = 'Error: raw-backend-token-marker\n at stack'

    recordCacheRevalidationVisibilityFromLogPayload(
      {
        event: REVALIDATION_LOG_EVENTS.failed,
        operation: 'update',
        source: { kind: 'payload-hook', id: 'source-1' },
        subject: { kind: 'collection', id: 'subject-1', collection: 'posts' },
        cacheClasses: ['aggregated-public'],
        surfaceIds: ['posts-list'],
        tagCount: 12,
        pathCount: 11,
        failureCount: 12,
        tagsPreview: Array.from({ length: 12 }, (_, index) => `collection:posts:${index}`),
        pathsPreview: Array.from({ length: 11 }, (_, index) => `/posts/${index}`),
        failuresPreview: Array.from({ length: 12 }, (_, index) => ({
          kind: index % 2 === 0 ? 'tag' : 'path',
          identifier: `identifier-${index}`,
          message: rawStack,
        })),
        tagsTruncated: true,
        pathsTruncated: true,
        failuresTruncated: true,
        rawDoc,
        headers: { authorization: 'Bearer raw-marker' },
        cookies: 'session=raw-marker',
      },
      () => '2026-07-08T10:00:00.000Z',
    )

    const [event] = getCacheRevalidationVisibilitySnapshot().events
    const serialized = JSON.stringify(event)

    expect(event?.tagsPreview).toHaveLength(CACHE_REVALIDATION_VISIBILITY_PREVIEW_LIMIT)
    expect(event?.pathsPreview).toHaveLength(CACHE_REVALIDATION_VISIBILITY_PREVIEW_LIMIT)
    expect(event?.failuresPreview).toHaveLength(CACHE_REVALIDATION_VISIBILITY_PREVIEW_LIMIT)
    expect(event?.failuresPreview[0]).toEqual({
      kind: 'tag',
      identifier: 'identifier-0',
      message: 'redacted',
    })
    expect(event?.tagsTruncated).toBe(true)
    expect(event?.pathsTruncated).toBe(true)
    expect(event?.failuresTruncated).toBe(true)
    expect(serialized).not.toContain('raw-doc-marker')
    expect(serialized).not.toContain('raw-backend-token-marker')
    expect(serialized).not.toContain('authorization')
    expect(serialized).not.toContain('session=raw-marker')
  })

  it('resets test history without leaking previous events', () => {
    recordCacheRevalidationVisibilityFromLogPayload(createPayload(1))
    expect(getCacheRevalidationVisibilitySnapshot().count).toBe(1)

    resetCacheRevalidationVisibilityForTests()

    expect(getCacheRevalidationVisibilitySnapshot()).toMatchObject({
      count: 0,
      totalRecorded: 0,
      droppedOldestCount: 0,
      events: [],
    })
  })

  it('records planned, executed, and failed executor events without changing tag-first order', () => {
    const order: string[] = []
    vi.mocked(revalidateTag).mockImplementation(() => {
      order.push('tag')
      throw new Error('raw backend stack should not be stored')
    })
    vi.mocked(revalidatePath).mockImplementation(() => {
      order.push('path')
    })

    executeRevalidationPlan(createPlan())

    expect(order).toEqual(['tag', 'path'])
    const snapshot = getCacheRevalidationVisibilitySnapshot()
    expect(snapshot.events.map((event) => event.event)).toEqual([
      REVALIDATION_LOG_EVENTS.failed,
      REVALIDATION_LOG_EVENTS.executed,
      REVALIDATION_LOG_EVENTS.planned,
    ])
    expect(snapshot.events[0]).toMatchObject({
      failureCount: 1,
      failuresPreview: [{ kind: 'tag', identifier: 'collection:posts', message: 'redacted' }],
    })
    expect(JSON.stringify(snapshot.events)).not.toContain('raw backend stack')
  })
})
