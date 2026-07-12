import { describe, it, expect, beforeEach, vi } from 'vitest'
import { revalidatePage, revalidateDelete } from '@/collections/Pages/hooks/revalidatePage'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PayloadRequest } from 'payload'
import { createMockReq } from '../helpers/testHelpers'

type PageDoc = {
  id: string | number
  _status?: 'draft' | 'published'
  slug: string
}

const buildReq = (disableRevalidate = false): PayloadRequest =>
  createMockReq(null, undefined, {
    context: {
      disableRevalidate,
    },
  })

const getPathCalls = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
const getTagCalls = () => vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)

type AfterChangeArgs = Parameters<typeof revalidatePage>[0]
type AfterDeleteArgs = Parameters<typeof revalidateDelete>[0]

const buildAfterChangeArgs = (args: { doc: PageDoc; previousDoc?: PageDoc; req: PayloadRequest }): AfterChangeArgs => ({
  collection: { slug: 'pages' } as unknown as AfterChangeArgs['collection'],
  context: args.req.context,
  data: {},
  doc: args.doc,
  operation: 'update',
  previousDoc: args.previousDoc,
  req: args.req,
})

const buildAfterDeleteArgs = (args: { doc: PageDoc; req: PayloadRequest }): AfterDeleteArgs => ({
  collection: { slug: 'pages' } as unknown as AfterDeleteArgs['collection'],
  context: args.req.context,
  doc: args.doc,
  id: 1,
  req: args.req,
})

describe('Pages revalidation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('revalidates published page path and pages sitemap', () => {
    const req = buildReq(false)
    const doc: PageDoc = { id: 1, _status: 'published', slug: 'about' }

    const result = revalidatePage(
      buildAfterChangeArgs({
        doc,
        previousDoc: undefined,
        req,
      }),
    ) as PageDoc

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual(['/about'])
    expect(getTagCalls()).toEqual(['entity:pages:1', 'collection:pages', 'slug:pages:about', 'surface:sitemap:pages'])
  })

  it('revalidates old path when page transitions from published to draft', () => {
    const req = buildReq(false)
    const previousDoc: PageDoc = { id: 1, _status: 'published', slug: 'home' }
    const doc: PageDoc = { id: 1, _status: 'draft', slug: 'home' }

    revalidatePage(
      buildAfterChangeArgs({
        doc,
        previousDoc,
        req,
      }),
    )

    expect(getPathCalls()).toEqual(['/'])
    expect(getTagCalls()).toEqual(['entity:pages:1', 'collection:pages', 'slug:pages:home', 'surface:sitemap:pages'])
  })

  it('revalidates old and new paths when a published page slug changes', () => {
    const req = buildReq(false)
    const previousDoc: PageDoc = { id: 1, _status: 'published', slug: 'old-about' }
    const doc: PageDoc = { id: 1, _status: 'published', slug: 'about' }

    revalidatePage(
      buildAfterChangeArgs({
        doc,
        previousDoc,
        req,
      }),
    )

    expect(getPathCalls()).toEqual(['/about', '/old-about'])
    expect(getTagCalls()).toEqual([
      'entity:pages:1',
      'collection:pages',
      'slug:pages:about',
      'slug:pages:old-about',
      'surface:sitemap:pages',
    ])
  })

  it('skips revalidation when disabled via context', () => {
    const req = buildReq(true)
    const doc: PageDoc = { id: 1, _status: 'published', slug: 'pricing' }

    revalidatePage(
      buildAfterChangeArgs({
        doc,
        previousDoc: undefined,
        req,
      }),
    )

    revalidateDelete(buildAfterDeleteArgs({ doc, req }))

    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it('revalidates deleted page path and pages sitemap', () => {
    const req = buildReq(false)
    const doc: PageDoc = { id: 1, _status: 'published', slug: 'home' }

    const result = revalidateDelete(buildAfterDeleteArgs({ doc, req })) as PageDoc

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual(['/'])
    expect(getTagCalls()).toEqual(['entity:pages:1', 'collection:pages', 'slug:pages:home', 'surface:sitemap:pages'])
  })

  it('throws strict adapter errors before revalidating invalid page events', () => {
    const req = buildReq(false)
    const doc = { id: 1, _status: 'published' } as PageDoc

    expect(() => revalidatePage(buildAfterChangeArgs({ doc, req }))).toThrow(/document slug/)
    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it('keeps executor failures best-effort for CMS writes', () => {
    const req = buildReq(false)
    const doc: PageDoc = { id: 1, _status: 'published', slug: 'about' }
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('cache unavailable')
    })

    const result = revalidatePage(buildAfterChangeArgs({ doc, req })) as PageDoc

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual(['/about'])
  })
})
