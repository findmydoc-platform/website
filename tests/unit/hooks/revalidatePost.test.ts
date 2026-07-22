import { describe, it, expect, beforeEach, vi } from 'vitest'
import { revalidatePost, revalidateDelete } from '@/collections/Posts/hooks/revalidatePost'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PayloadRequest } from 'payload'
import { createMockReq } from '../helpers/testHelpers'

type PostDoc = {
  id: string | number
  _status?: 'draft' | 'published'
  slug?: string
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
    const doc: PostDoc = { id: 'post-1', _status: 'published', slug: 'example-post' }
    const previousDoc: PostDoc = { id: 'post-1', _status: 'draft', slug: 'example-post' }

    const result = revalidatePost(
      buildAfterChangeArgs({
        doc,
        previousDoc,
        req,
      }),
    ) as PostDoc

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual(['/posts/example-post', '/posts'])
    expect(getPathCalls()).not.toContain('/posts/page/2')
    expect(getTagCalls()).toEqual([
      'entity:posts:post-1',
      'collection:posts',
      'slug:posts:example-post',
      'surface:sitemap:posts',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
    ])
  })

  it('revalidates old path when post transitions from published to draft', () => {
    const req = buildReq(false)
    const previousDoc: PostDoc = { id: 'post-1', _status: 'published', slug: 'old-post' }
    const doc: PostDoc = { id: 'post-1', _status: 'draft', slug: 'old-post' }

    revalidatePost(
      buildAfterChangeArgs({
        doc,
        previousDoc,
        req,
      }),
    )

    expect(getPathCalls()).toEqual(['/posts/old-post', '/posts'])
    expect(getTagCalls()).toEqual([
      'entity:posts:post-1',
      'collection:posts',
      'slug:posts:old-post',
      'surface:sitemap:posts',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
    ])
  })

  it('revalidates old and new paths when a published post slug changes', () => {
    const req = buildReq(false)
    const previousDoc: PostDoc = { id: 'post-1', _status: 'published', slug: 'old-post' }
    const doc: PostDoc = { id: 'post-1', _status: 'published', slug: 'new-post' }

    revalidatePost(
      buildAfterChangeArgs({
        doc,
        previousDoc,
        req,
      }),
    )

    expect(getPathCalls()).toEqual(['/posts/new-post', '/posts/old-post', '/posts'])
    expect(getTagCalls()).toEqual([
      'entity:posts:post-1',
      'collection:posts',
      'slug:posts:new-post',
      'slug:posts:old-post',
      'surface:sitemap:posts',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
    ])
  })

  it('revalidates published post path when previousDoc is absent', () => {
    const req = buildReq(false)
    const doc: PostDoc = { id: 'post-1', _status: 'published', slug: 'first-save-post' }
    let result: unknown

    expect(() => {
      result = revalidatePost(
        buildAfterChangeArgs({
          doc,
          previousDoc: undefined,
          req,
        }),
      )
    }).not.toThrow()

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual(['/posts/first-save-post', '/posts'])
    expect(getTagCalls()).toEqual([
      'entity:posts:post-1',
      'collection:posts',
      'slug:posts:first-save-post',
      'surface:sitemap:posts',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
    ])
  })

  it('skips incomplete autosaved drafts until a slug exists', () => {
    const req = buildReq(false)
    const doc: PostDoc = { id: 'post-1', _status: 'draft' }

    const result = revalidatePost(buildAfterChangeArgs({ doc, req })) as PostDoc

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it('revalidates the previous public path when an unpublished draft has no slug', () => {
    const req = buildReq(false)
    const previousDoc: PostDoc = { id: 'post-1', _status: 'published', slug: 'old-post' }
    const doc: PostDoc = { id: 'post-1', _status: 'draft' }

    revalidatePost(buildAfterChangeArgs({ doc, previousDoc, req }))

    expect(getPathCalls()).toEqual(['/posts/old-post', '/posts'])
    expect(getTagCalls()).toEqual([
      'entity:posts:post-1',
      'collection:posts',
      'slug:posts:old-post',
      'surface:sitemap:posts',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
    ])
  })

  it('skips revalidation when disabled via context', () => {
    const req = buildReq(true)
    const doc: PostDoc = { id: 'post-1', _status: 'published', slug: 'skip-post' }

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
    const doc: PostDoc = { id: 'post-1', _status: 'published', slug: 'deleted-post' }

    const result = revalidateDelete(buildAfterDeleteArgs({ doc, req })) as PostDoc

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual(['/posts/deleted-post', '/posts'])
    expect(getTagCalls()).toEqual([
      'entity:posts:post-1',
      'collection:posts',
      'slug:posts:deleted-post',
      'surface:sitemap:posts',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
    ])
  })

  it('throws strict adapter errors before revalidating events without a status', () => {
    const req = buildReq(false)
    const doc = { id: 'post-1', slug: 'missing-status' } as PostDoc

    expect(() => revalidatePost(buildAfterChangeArgs({ doc, req }))).toThrow(/document status/)
    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })
})
