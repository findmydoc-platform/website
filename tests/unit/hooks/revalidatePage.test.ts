import { beforeEach, describe, expect, it, vi } from 'vitest'
import { capturePageDraftSaveIntent } from '@/collections/Pages/hooks/pageDraftIntent'
import {
  capturePageBeforeChange,
  capturePageBeforeDelete,
  revalidateDelete,
  revalidatePage,
} from '@/collections/Pages/hooks/revalidatePage'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PayloadRequest } from 'payload'
import { createMockReq } from '../helpers/testHelpers'

const page = { id: 1 } as Parameters<typeof revalidatePage>[0]['doc']
const buildReq = (disableRevalidate = false) => createMockReq(null, undefined, { context: { disableRevalidate } })
const getPathCalls = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
const getTagCalls = () => vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)

type AfterChangeArgs = Parameters<typeof revalidatePage>[0]
type PageSlugs = Partial<Record<'de' | 'en', string>>

function setPublishedSlugs(req: PayloadRequest, slugs: PageSlugs) {
  vi.mocked(req.payload.find).mockImplementation(async ({ locale }) => {
    const slug = locale === 'de' || locale === 'en' ? slugs[locale] : undefined
    return { docs: slug ? [{ id: page.id, slug }] : [] } as Awaited<ReturnType<typeof req.payload.find>>
  })
}

async function savePage(req: PayloadRequest, before: PageSlugs, after: PageSlugs) {
  const collection = { slug: 'pages' } as AfterChangeArgs['collection']
  const base = { context: req.context, collection, req, operation: 'update' as const, data: {} }
  setPublishedSlugs(req, before)
  await capturePageBeforeChange({ ...base, originalDoc: page })
  setPublishedSlugs(req, after)
  return revalidatePage({ ...base, doc: page, previousDoc: page })
}

describe('Pages revalidation hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('revalidates the published path and pages sitemap', async () => {
    const result = await savePage(buildReq(), {}, { de: 'about' })

    expect(result).toBe(page)
    expect(getPathCalls()).toEqual(['/about'])
    expect(getTagCalls()).toEqual(['entity:pages:1', 'collection:pages', 'slug:pages:about', 'surface:sitemap:pages'])
  })

  it('invalidates both locale paths when English is withdrawn and German stays published', async () => {
    await savePage(buildReq(), { en: 'about', de: 'ueber-uns' }, { de: 'ueber-uns' })

    expect(getPathCalls()).toEqual(['/en/about', '/ueber-uns'])
    expect(getTagCalls()).toContain('surface:sitemap:pages')
  })

  it('revalidates old and new paths when a published English slug changes', async () => {
    await savePage(buildReq(), { en: 'old-about' }, { en: 'about' })

    expect(getPathCalls()).toEqual(['/en/about', '/en/old-about'])
    expect(getTagCalls()).toEqual([
      'entity:pages:1',
      'collection:pages',
      'slug:pages:about',
      'slug:pages:old-about',
      'surface:sitemap:pages',
    ])
  })

  it('invalidates both canonical paths for all-locale publication', async () => {
    await savePage(buildReq(), {}, { en: 'about', de: 'ueber-uns' })

    expect(getPathCalls()).toEqual(['/en/about', '/ueber-uns'])
    expect(getTagCalls()).toContain('surface:sitemap:pages')
  })

  it('does not read published routes or invalidate caches on draft saves', async () => {
    const req = buildReq()
    capturePageDraftSaveIntent({
      args: { draft: true },
      context: req.context,
      collection: { slug: 'pages' } as AfterChangeArgs['collection'],
      operation: 'update',
      req,
    } as unknown as Parameters<typeof capturePageDraftSaveIntent>[0])
    await savePage(req, { de: 'about' }, { de: 'about' })

    expect(req.payload.find).not.toHaveBeenCalled()
    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it('invalidates a published Page even when the update has the Payload draft flag', async () => {
    const req = buildReq()
    capturePageDraftSaveIntent({
      args: { draft: true, data: { _status: 'published' } },
      context: req.context,
      collection: { slug: 'pages' } as AfterChangeArgs['collection'],
      operation: 'update',
      req,
    } as unknown as Parameters<typeof capturePageDraftSaveIntent>[0])
    await savePage(req, { en: 'old-about' }, { en: 'about' })

    expect(getPathCalls()).toEqual(['/en/about', '/en/old-about'])
    expect(getTagCalls()).toContain('surface:sitemap:pages')
  })

  it('skips revalidation when disabled via context', async () => {
    const req = buildReq(true)
    await savePage(req, {}, { de: 'pricing' })

    expect(req.payload.find).not.toHaveBeenCalled()
    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it('does not invalidate caches for a document without a public slug in either locale', async () => {
    await savePage(buildReq(), {}, {})

    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it('invalidates all previously public paths on document deletion', async () => {
    const req = buildReq()
    const args = {
      context: req.context,
      collection: { slug: 'pages' } as AfterChangeArgs['collection'],
      id: page.id,
      req,
    }
    setPublishedSlugs(req, { en: 'about', de: 'home' })

    await capturePageBeforeDelete(args)
    expect(await revalidateDelete({ ...args, doc: page })).toBe(page)

    expect(getPathCalls()).toEqual(['/en/about', '/'])
    expect(getTagCalls()).toContain('surface:sitemap:pages')
  })

  it('keeps executor failures best-effort for CMS writes', async () => {
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('cache unavailable')
    })

    expect(await savePage(buildReq(), {}, { de: 'about' })).toBe(page)
    expect(getPathCalls()).toEqual(['/about'])
  })
})
