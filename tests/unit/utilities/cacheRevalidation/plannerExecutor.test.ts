import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { revalidatePath, revalidateTag } from 'next/cache'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildRevalidationLogPayload,
  DeferredRevalidationError,
  executeRevalidationPlan,
  InvalidRevalidationPlanError,
  planRevalidation,
  REVALIDATION_LOG_EVENTS,
  UnsupportedRevalidationEventError,
  type RevalidationLogger,
  type RevalidationPlan,
} from '@/utilities/cacheRevalidation'

const pageEvent = {
  kind: 'collection',
  collection: 'pages',
  operation: 'slug-change',
  source: {
    kind: 'payload-hook',
    id: 'pages:123',
    correlationId: 'correlation-1',
  },
  subject: {
    id: 123,
    slug: 'care-abroad',
    previousSlug: 'old-care-abroad',
    status: 'published',
    previousStatus: 'published',
  },
} as const

const resetNextCacheMocks = () => {
  vi.mocked(revalidateTag).mockReset()
  vi.mocked(revalidatePath).mockReset()
  vi.mocked(revalidateTag).mockImplementation(() => undefined)
  vi.mocked(revalidatePath).mockImplementation(() => undefined)
}

describe('cache revalidation planner', () => {
  afterEach(() => {
    resetNextCacheMocks()
  })

  it('maps page hook events into serializable canonical tags and paths', () => {
    const plan = planRevalidation(pageEvent)

    expect(JSON.parse(JSON.stringify(plan))).toMatchObject(plan)
    expect(plan).toMatchObject({
      operation: 'slug-change',
      cacheClasses: ['critical-public', 'aggregated-public'],
      surfaceIds: ['page-detail', 'surface:sitemap:pages'],
      tags: [
        'entity:pages:123',
        'collection:pages',
        'slug:pages:care-abroad',
        'slug:pages:old-care-abroad',
        'surface:sitemap:pages',
      ],
      paths: ['/care-abroad', '/old-care-abroad'],
      logContext: {
        operation: 'slug-change',
        sourceKind: 'payload-hook',
        sourceId: 'pages:123',
        correlationId: 'correlation-1',
        subjectKind: 'collection',
        subjectId: '123',
        collection: 'pages',
        tagCount: 5,
        pathCount: 2,
      },
    })
  })

  it('maps post events into detail, list, landing, and sitemap freshness', () => {
    const plan = planRevalidation({
      kind: 'collection',
      collection: 'posts',
      operation: 'publish',
      source: { kind: 'payload-hook' },
      subject: {
        id: 'post-1',
        slug: 'clinic-checklist',
        status: 'published',
      },
    })

    expect(plan.tags).toEqual([
      'entity:posts:post-1',
      'collection:posts',
      'slug:posts:clinic-checklist',
      'surface:sitemap:posts',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
    ])
    expect(plan.paths).toEqual(['/posts/clinic-checklist', '/posts'])
    expect(plan.surfaceIds).toEqual(['post-detail', 'posts-list', 'home', 'partners-clinics', 'surface:sitemap:posts'])
  })

  it('maps globals and redirects through PR3 core surfaces only', () => {
    expect(
      planRevalidation({
        kind: 'global',
        global: 'header',
        operation: 'global-update',
        source: { kind: 'global-hook' },
      }),
    ).toMatchObject({
      cacheClasses: ['shared-public'],
      surfaceIds: ['public-chrome'],
      tags: ['global:header', 'surface:public-chrome'],
      paths: [],
    })

    expect(
      planRevalidation({
        kind: 'global',
        global: 'landingPages',
        operation: 'global-update',
        source: { kind: 'global-hook' },
      }),
    ).toMatchObject({
      cacheClasses: ['aggregated-public'],
      surfaceIds: ['home', 'about', 'partners-clinics', 'surface:sitemap:pages'],
      tags: [
        'global:landingPages',
        'surface:home',
        'surface:about',
        'surface:partners-clinics',
        'surface:sitemap:pages',
      ],
      paths: ['/', '/about', '/partners/clinics'],
    })

    expect(
      planRevalidation({
        kind: 'redirects',
        operation: 'update',
        source: { kind: 'redirect-hook' },
        subject: { id: 'redirect-1' },
      }),
    ).toMatchObject({
      cacheClasses: ['critical-public'],
      surfaceIds: ['redirects'],
      tags: ['collection:redirects', 'surface:redirects'],
      paths: [],
      subject: { kind: 'redirects', id: 'redirect-1' },
    })
  })

  it('fails fast for invalid core events and explicit deferred areas', () => {
    expect(() =>
      planRevalidation({
        kind: 'unknown',
        operation: 'update',
        source: { kind: 'test' },
      } as never),
    ).toThrow(UnsupportedRevalidationEventError)

    expect(() =>
      planRevalidation({
        kind: 'collection',
        collection: 'pages',
        operation: 'update',
        source: { kind: 'payload-hook' },
        subject: {
          id: 'page-1',
          slug: ' ',
          status: 'published',
        },
      }),
    ).toThrow(UnsupportedRevalidationEventError)

    expect(() =>
      planRevalidation({
        kind: 'collection',
        collection: 'posts',
        operation: 'publish',
        source: { kind: 'payload-hook' },
        subject: {
          id: 'post-1',
          slug: 'hello world',
          status: 'published',
        },
      }),
    ).toThrow(/whitespace/)

    expect(() =>
      planRevalidation({
        kind: 'collection',
        collection: 'pages',
        operation: 'delete',
        source: { kind: 'payload-hook' },
        subject: {
          id: 'draft-page-1',
          slug: 'draft-page',
          status: 'draft',
        },
      }),
    ).toThrow(/previous status/)

    expect(() =>
      planRevalidation({
        kind: 'deferred',
        area: 'clinic-listing',
        operation: 'related-update',
        source: { kind: 'payload-hook' },
      }),
    ).toThrow(DeferredRevalidationError)
  })

  it('keeps draft-only and private-live events as empty plans without public cache identifiers', () => {
    expect(
      planRevalidation({
        kind: 'collection',
        collection: 'pages',
        operation: 'update',
        source: { kind: 'payload-hook', id: 'draft-source', correlationId: 'draft-correlation' },
        subject: {
          id: 'draft-page-1',
          slug: 'draft-only',
          status: 'draft',
          previousStatus: 'draft',
        },
      }),
    ).toMatchObject({
      cacheClasses: ['private-live'],
      surfaceIds: [],
      tags: [],
      paths: [],
      emptyReason: 'private-live-noop',
    })

    expect(
      planRevalidation({
        kind: 'private-live',
        operation: 'preview-read',
        source: { kind: 'test', id: 'preview-source', correlationId: 'preview-correlation' },
        subject: { surfaceId: 'preview' },
      }),
    ).toMatchObject({
      cacheClasses: ['private-live'],
      surfaceIds: [],
      tags: [],
      paths: [],
      emptyReason: 'private-live-noop',
      subject: { kind: 'private-live', surfaceId: 'preview' },
    })
  })

  it('keeps the planner boundary pure from runtime integrations', () => {
    const plannerSource = readFileSync(join(process.cwd(), 'src/utilities/cacheRevalidation/planner.ts'), 'utf8')

    expect(plannerSource).not.toContain('next/cache')
    expect(plannerSource).not.toContain('@payload-config')
    expect(plannerSource).not.toContain('getPayload')
    expect(plannerSource).not.toContain('createScopedLogger')
    expect(plannerSource).not.toContain('process.env')
    expect(plannerSource).not.toContain('posthog')
    expect(plannerSource).not.toContain('node:fs')
  })
})

describe('cache revalidation executor', () => {
  afterEach(() => {
    resetNextCacheMocks()
  })

  it('executes tags before paths and reports successful counts', () => {
    const calls: string[] = []
    const plan = planRevalidation(pageEvent)

    vi.mocked(revalidateTag).mockImplementation((tag) => {
      calls.push(`tag:${tag}`)
    })
    vi.mocked(revalidatePath).mockImplementation((path) => {
      calls.push(`path:${path}`)
    })

    const result = executeRevalidationPlan(plan)

    expect(calls).toEqual([
      'tag:entity:pages:123',
      'tag:collection:pages',
      'tag:slug:pages:care-abroad',
      'tag:slug:pages:old-care-abroad',
      'tag:surface:sitemap:pages',
      'path:/care-abroad',
      'path:/old-care-abroad',
    ])
    expect(result).toMatchObject({
      attempted: { tagCount: 5, pathCount: 2 },
      succeeded: { tagCount: 5, pathCount: 2 },
      failed: { tagCount: 0, pathCount: 0 },
      failures: [],
    })
  })

  it('continues best-effort execution and logs redacted summaries when operations fail', () => {
    const plan = planRevalidation(pageEvent)
    const info = vi.fn()
    const warn = vi.fn()
    const logger = { info, warn } satisfies RevalidationLogger

    vi.mocked(revalidateTag).mockImplementation((tag) => {
      if (tag === 'collection:pages') {
        throw new Error('tag-store unavailable')
      }
    })
    vi.mocked(revalidatePath).mockImplementation((path) => {
      if (path === '/old-care-abroad') {
        throw new Error('path-store unavailable')
      }
    })

    const result = executeRevalidationPlan(plan, { logger })

    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(5)
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      attempted: { tagCount: 5, pathCount: 2 },
      succeeded: { tagCount: 4, pathCount: 1 },
      failed: { tagCount: 1, pathCount: 1 },
      failures: [
        { kind: 'tag', identifier: 'collection:pages', message: 'tag-store unavailable' },
        { kind: 'path', identifier: '/old-care-abroad', message: 'path-store unavailable' },
      ],
    })
    expect(info.mock.calls.map(([payload]) => payload.event)).toEqual([
      REVALIDATION_LOG_EVENTS.planned,
      REVALIDATION_LOG_EVENTS.executed,
    ])
    expect(warn.mock.calls[0]?.[0]).toMatchObject({
      event: REVALIDATION_LOG_EVENTS.failed,
      failureCount: 2,
      failuresPreview: [
        { kind: 'tag', identifier: 'collection:pages', message: 'tag-store unavailable' },
        { kind: 'path', identifier: '/old-care-abroad', message: 'path-store unavailable' },
      ],
    })
  })

  it('rejects invalid executor plans before touching Next cache APIs', () => {
    const plan = {
      ...planRevalidation(pageEvent),
      tags: ['entity:pages:123', ' '],
    } satisfies RevalidationPlan

    expect(() => executeRevalidationPlan(plan)).toThrow(InvalidRevalidationPlanError)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()

    expect(() =>
      executeRevalidationPlan({
        ...planRevalidation(pageEvent),
        tags: ['private:admin:1'],
      } satisfies RevalidationPlan),
    ).toThrow(InvalidRevalidationPlanError)

    expect(() =>
      executeRevalidationPlan({
        ...planRevalidation(pageEvent),
        paths: ['/admin'],
      } satisfies RevalidationPlan),
    ).toThrow(InvalidRevalidationPlanError)
  })

  it('builds log payloads from an allowlist and does not leak raw operational data', () => {
    const planWithRawFields = {
      ...planRevalidation(pageEvent),
      rawDoc: { privateMedicalText: 'private diagnosis', token: 'super-secret-token' },
      request: { cookie: 'session=secret', authorization: 'Bearer secret' },
      err: { stack: 'sensitive stack trace' },
    } as unknown as RevalidationPlan

    const payload = buildRevalidationLogPayload({
      eventName: REVALIDATION_LOG_EVENTS.planned,
      plan: planWithRawFields,
    })
    const serializedPayload = JSON.stringify(payload)

    expect(serializedPayload).toContain('cache.revalidation.planned')
    expect(serializedPayload).not.toContain('private diagnosis')
    expect(serializedPayload).not.toContain('super-secret-token')
    expect(serializedPayload).not.toContain('session=secret')
    expect(serializedPayload).not.toContain('Bearer secret')
    expect(serializedPayload).not.toContain('sensitive stack trace')
  })

  it('redacts private-live source and subject identifiers from log payloads', () => {
    const plan = planRevalidation({
      kind: 'collection',
      collection: 'pages',
      operation: 'update',
      source: { kind: 'payload-hook', id: 'private-source-id', correlationId: 'private-correlation-id' },
      subject: {
        id: 'private-draft-page',
        slug: 'private-draft',
        status: 'draft',
        previousStatus: 'draft',
      },
    })

    const payload = buildRevalidationLogPayload({
      eventName: REVALIDATION_LOG_EVENTS.planned,
      plan,
    })
    const serializedPayload = JSON.stringify(payload)

    expect(payload).toMatchObject({
      event: REVALIDATION_LOG_EVENTS.planned,
      source: { kind: 'payload-hook' },
      subject: { kind: 'private-live' },
      emptyReason: 'private-live-noop',
      tagCount: 0,
      pathCount: 0,
    })
    expect(serializedPayload).not.toContain('private-source-id')
    expect(serializedPayload).not.toContain('private-correlation-id')
    expect(serializedPayload).not.toContain('private-draft-page')
    expect(serializedPayload).not.toContain('private-draft')
  })
})
