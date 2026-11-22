import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  PayloadRequest,
} from 'payload'

import {
  executeCollectionChangeRevalidation,
  executeCollectionDeleteRevalidation,
} from '@/hooks/cacheRevalidationAdapters'
import type { Page } from '@/payload-types'
import { CONTENT_LOCALES, type ContentLocale } from '@/utilities/contentLocalization'
import { isPageDraftSaveIntent } from './pageDraftIntent'

const PAGE_PUBLIC_SLUGS_BEFORE_MUTATION = 'pagePublicSlugsBeforeMutation'
type PublishedSlugs = Partial<Record<ContentLocale, string>>
type PageId = string | number

async function getPublishedSlugs(req: PayloadRequest, id: PageId): Promise<PublishedSlugs> {
  const publishedSlugs: PublishedSlugs = {}
  for (const locale of CONTENT_LOCALES) {
    const result = await req.payload.find({
      collection: 'pages',
      locale,
      fallbackLocale: false,
      draft: false,
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: false,
      req: { ...req, user: null, query: { ...req.query } },
      select: { slug: true },
      where: { and: [{ id: { equals: id } }, { _status: { equals: 'published' } }] },
    })
    const slug = result.docs[0]?.slug
    if (slug) publishedSlugs[locale] = slug
  }
  return publishedSlugs
}

function getPreviousPublishedSlugs(req: PayloadRequest): Map<PageId, PublishedSlugs> {
  const existing = req.context[PAGE_PUBLIC_SLUGS_BEFORE_MUTATION]
  if (existing instanceof Map) return existing
  const snapshots = new Map<PageId, PublishedSlugs>()
  req.context[PAGE_PUBLIC_SLUGS_BEFORE_MUTATION] = snapshots
  return snapshots
}

async function capturePublishedSlugs(req: PayloadRequest, id: PageId) {
  const previous = await getPublishedSlugs(req, id)
  getPreviousPublishedSlugs(req).set(id, previous)
}

function takePreviousPublishedSlugs(req: PayloadRequest, id: PageId): PublishedSlugs {
  const snapshots = getPreviousPublishedSlugs(req)
  const previous = snapshots.get(id) ?? {}
  snapshots.delete(id)
  return previous
}

export const capturePageBeforeChange: CollectionBeforeChangeHook<Page> = async ({ data, originalDoc, req }) => {
  if (originalDoc && !req.context.disableRevalidate && !isPageDraftSaveIntent(req.context)) {
    await capturePublishedSlugs(req, originalDoc.id)
  }
  return data
}

export const capturePageBeforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (!req.context.disableRevalidate) await capturePublishedSlugs(req, id)
}

export const revalidatePage: CollectionAfterChangeHook<Page> = async ({ doc, req }) => {
  if (req.context.disableRevalidate || isPageDraftSaveIntent(req.context)) return doc

  const before = takePreviousPublishedSlugs(req, doc.id)
  const after = await getPublishedSlugs(req, doc.id)
  for (const locale of CONTENT_LOCALES) {
    if (!before[locale] && !after[locale]) continue
    executeCollectionChangeRevalidation({
      collection: 'pages',
      locale,
      doc: { id: doc.id, slug: after[locale], _status: after[locale] ? 'published' : 'draft' },
      previousDoc: before[locale] ? { id: doc.id, slug: before[locale], _status: 'published' } : undefined,
      logger: req.payload.logger,
    })
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = ({ doc, id, req }) => {
  if (req.context.disableRevalidate) return doc

  const previous = takePreviousPublishedSlugs(req, id)
  for (const locale of CONTENT_LOCALES) {
    if (!previous[locale]) continue
    executeCollectionDeleteRevalidation({
      collection: 'pages',
      locale,
      doc: { id, slug: previous[locale], _status: 'published' },
      logger: req.payload.logger,
    })
  }
  return doc
}
