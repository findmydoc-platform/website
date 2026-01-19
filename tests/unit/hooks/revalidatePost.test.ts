import { describe, it, expect, beforeEach, vi } from 'vitest'
import { revalidatePost, revalidateDelete } from '@/collections/Posts/hooks/revalidatePost'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PayloadRequest } from 'payload'
import { createMockReq } from '../helpers/testHelpers'

type PostDoc = {
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

type AfterChangeArgs = Parameters<typeof revalidatePost>[0]
type AfterDeleteArgs = Parameters<typeof revalidateDelete>[0]

const buildAfterChangeArgs = (args: { doc: PostDoc; previousDoc?: PostDoc; req: PayloadRequest }): AfterChangeArgs => ({
  collection: { slug: 'posts' } as unknown as AfterChangeArgs['collection'],
  context: args.req.context,
  data: {},
  doc: args.doc,
  operation: 'update',
  previousDoc: args.previousDoc,
  req: args.req,
})

const buildAfterDeleteArgs = (args: { doc: PostDoc; req: PayloadRequest }): AfterDeleteArgs => ({
  collection: { slug: 'posts' } as unknown as AfterDeleteArgs['collection'],
  context: args.req.context,
  doc: args.doc,
  id: 1,
  req: args.req,
})

describe('Posts revalidation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('revalidates published post path and posts sitemap', () => {
    const req = buildReq(false)
    const doc: PostDoc = { _status: 'published', slug: 'example-post' }
    const previousDoc: PostDoc = { _status: 'draft', slug: 'example-post' }

    const result = revalidatePost(
      buildAfterChangeArgs({
        doc,
        previousDoc,
        req,
      }),
    ) as PostDoc

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual(['/posts/example-post'])
    expect(getTagCalls()).toEqual(['posts-sitemap'])
  })

  it('revalidates old path when post transitions from published to draft', () => {
    const req = buildReq(false)
    const previousDoc: PostDoc = { _status: 'published', slug: 'old-post' }
    const doc: PostDoc = { _status: 'draft', slug: 'old-post' }

    revalidatePost(
      buildAfterChangeArgs({
        doc,
        previousDoc,
        req,
      }),
    )

    expect(getPathCalls()).toEqual(['/posts/old-post'])
    expect(getTagCalls()).toEqual(['posts-sitemap'])
  })

  it('skips revalidation when disabled via context', () => {
    const req = buildReq(true)
    const doc: PostDoc = { _status: 'published', slug: 'skip-post' }

    revalidatePost(
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

  it('revalidates deleted post path and posts sitemap', () => {
    const req = buildReq(false)
    const doc: PostDoc = { _status: 'published', slug: 'deleted-post' }

    const result = revalidateDelete(buildAfterDeleteArgs({ doc, req })) as PostDoc

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual(['/posts/deleted-post'])
    expect(getTagCalls()).toEqual(['posts-sitemap'])
  })
})
