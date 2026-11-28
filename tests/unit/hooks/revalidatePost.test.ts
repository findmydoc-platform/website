import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  capturePostBeforeChange,
  capturePostBeforeDelete,
  capturePostDraftSaveIntent,
  revalidateDelete,
  revalidatePost,
} from '@/collections/Posts/hooks/revalidatePost'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PayloadRequest } from 'payload'
import { createMockReq } from '../helpers/testHelpers'

const post = { id: 1 } as Parameters<typeof revalidatePost>[0]['doc']
const buildReq = (disableRevalidate = false) => createMockReq(null, undefined, { context: { disableRevalidate } })
const getPathCalls = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
const getTagCalls = () => vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)

type AfterChangeArgs = Parameters<typeof revalidatePost>[0]
type PostSlugs = Partial<Record<'de' | 'en', string>>

function setPublishedSlugs(req: PayloadRequest, slugs: PostSlugs) {
  vi.mocked(req.payload.find).mockImplementation(async ({ locale }) => {
    const slug = locale === 'de' || locale === 'en' ? slugs[locale] : undefined
    return { docs: slug ? [{ id: post.id, slug }] : [] } as Awaited<ReturnType<typeof req.payload.find>>
  })
}

async function savePost(req: PayloadRequest, before: PostSlugs, after: PostSlugs) {
  const collection = { slug: 'posts' } as AfterChangeArgs['collection']
  const base = { context: req.context, collection, req, operation: 'update' as const, data: {} }
  setPublishedSlugs(req, before)
  await capturePostBeforeChange({ ...base, originalDoc: post })
  setPublishedSlugs(req, after)
  return revalidatePost({ ...base, doc: post, previousDoc: post })
}

describe('Posts revalidation hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invalidates both locale paths when English is withdrawn and German stays published', async () => {
    await savePost(buildReq(), { en: 'about', de: 'ueber-uns' }, { de: 'ueber-uns' })

    expect(getPathCalls()).toEqual([
      '/en/posts/about',
      '/posts',
      '/en/posts',
      '/posts/ueber-uns',
      '/posts',
      '/en/posts',
    ])
    expect(getTagCalls()).toContain('surface:sitemap:posts')
  })

  it('revalidates old and new paths when a published English slug changes', async () => {
    await savePost(buildReq(), { en: 'old-about' }, { en: 'about' })

    expect(getPathCalls()).toEqual(['/en/posts/about', '/en/posts/old-about', '/posts', '/en/posts'])
    expect(getTagCalls()).toEqual([
      'entity:posts:1',
      'collection:posts',
      'slug:posts:about',
      'slug:posts:old-about',
      'surface:sitemap:posts',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
    ])
  })

  it('invalidates both canonical paths for all-locale publication', async () => {
    await savePost(buildReq(), {}, { en: 'about', de: 'ueber-uns' })

    expect(getPathCalls()).toEqual([
      '/en/posts/about',
      '/posts',
      '/en/posts',
      '/posts/ueber-uns',
      '/posts',
      '/en/posts',
    ])
    expect(getTagCalls()).toContain('surface:sitemap:posts')
  })

  it('does not read published routes or invalidate caches on draft saves', async () => {
    const req = buildReq()
    capturePostDraftSaveIntent({
      args: { draft: true },
      context: req.context,
      collection: { slug: 'posts' } as AfterChangeArgs['collection'],
      operation: 'update',
      req,
    } as unknown as Parameters<typeof capturePostDraftSaveIntent>[0])
    await savePost(req, { de: 'about' }, { de: 'about' })

    expect(req.payload.find).not.toHaveBeenCalled()
    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it('invalidates all previously public paths on document deletion', async () => {
    const req = buildReq()
    const args = {
      context: req.context,
      collection: { slug: 'posts' } as AfterChangeArgs['collection'],
      id: post.id,
      req,
    }
    setPublishedSlugs(req, { en: 'about', de: 'home' })

    await capturePostBeforeDelete(args)
    expect(await revalidateDelete({ ...args, doc: post })).toBe(post)

    expect(getPathCalls()).toEqual(['/en/posts/about', '/posts', '/en/posts', '/posts/home', '/posts', '/en/posts'])
    expect(getTagCalls()).toContain('surface:sitemap:posts')
  })
})
