import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  PayloadRequest,
  TypeWithID,
} from 'payload'

import {
  executeCollectionChangeRevalidation,
  executeCollectionDeleteRevalidation,
} from '@/hooks/cacheRevalidationAdapters'
import { buildCmsRedirectPath } from '@/utilities/content/cmsRedirectPaths'
import { CONTENT_LOCALES, type ContentLocale } from '@/utilities/contentLocalization'
import { localizedDraftIntent } from './localizedDraftIntent'

type Collection = 'pages' | 'posts'
type PublishedSlugs = Partial<Record<ContentLocale, string>>
type DocumentId = TypeWithID['id']

export function localizedPublicationRevalidation<T extends { id: number }>(collection: Collection) {
  const previousPublishedSlugsKey = `${collection}PublicSlugsBeforeMutation`
  const { beforeOperation, isDraftSave } = localizedDraftIntent(collection)

  async function getPublishedSlugs(req: PayloadRequest, id: DocumentId): Promise<PublishedSlugs> {
    const publishedSlugs: PublishedSlugs = {}
    for (const locale of CONTENT_LOCALES) {
      const result = await req.payload.find({
        collection,
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

  function getSnapshots(req: PayloadRequest): Map<DocumentId, PublishedSlugs> {
    const existing = req.context[previousPublishedSlugsKey]
    if (existing instanceof Map) return existing
    const snapshots = new Map<DocumentId, PublishedSlugs>()
    req.context[previousPublishedSlugsKey] = snapshots
    return snapshots
  }

  function takeSnapshot(req: PayloadRequest, id: DocumentId): PublishedSlugs {
    const snapshots = getSnapshots(req)
    const previous = snapshots.get(id) ?? {}
    snapshots.delete(id)
    return previous
  }

  const beforeChange: CollectionBeforeChangeHook<T> = async ({ data, originalDoc, req }) => {
    if (originalDoc && !req.context.disableRevalidate && !isDraftSave(req.context)) {
      getSnapshots(req).set(originalDoc.id, await getPublishedSlugs(req, originalDoc.id))
    }
    return data
  }

  const beforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
    if (!req.context.disableRevalidate) {
      getSnapshots(req).set(id, await getPublishedSlugs(req, id))
    }
  }

  async function recordPublishedSlugRedirect(
    req: PayloadRequest,
    id: number,
    locale: ContentLocale,
    previousSlug: string,
  ) {
    const from = buildCmsRedirectPath(collection, locale, previousSlug)
    if (!from) return

    const request = { ...req, query: { ...req.query } }
    const existing = await req.payload.find({
      collection: 'redirects',
      req: request,
      overrideAccess: true,
      depth: 0,
      limit: 1,
      pagination: false,
      select: { type: true, to: { reference: true } },
      where: { from: { equals: from } },
    })
    const rule = existing.docs[0]
    const to = { type: 'reference' as const, reference: { relationTo: collection, value: id } }
    if (rule) {
      if (rule.type !== '301') return
      const reference = rule.to?.reference
      if (reference?.relationTo === collection && reference.value === id) return

      await req.payload.update({
        collection: 'redirects',
        id: rule.id,
        req: request,
        overrideAccess: true,
        depth: 0,
        data: { to },
      })
      return
    }

    await req.payload.create({
      collection: 'redirects',
      req: request,
      overrideAccess: true,
      depth: 0,
      data: {
        from,
        type: '301',
        to,
      },
    })
  }

  const afterChange: CollectionAfterChangeHook<T> = async ({ doc, req }) => {
    if (req.context.disableRevalidate || isDraftSave(req.context)) return doc

    const before = takeSnapshot(req, doc.id)
    const after = await getPublishedSlugs(req, doc.id)
    for (const locale of CONTENT_LOCALES) {
      const previousSlug = before[locale]
      const publishedSlug = after[locale]
      if (!previousSlug && !publishedSlug) continue
      // A withdrawn URL can resolve again when this locale is republished.
      if (previousSlug && previousSlug !== publishedSlug) {
        await recordPublishedSlugRedirect(req, doc.id, locale, previousSlug)
      }
      executeCollectionChangeRevalidation({
        collection,
        locale,
        doc: { id: doc.id, slug: publishedSlug, _status: publishedSlug ? 'published' : 'draft' },
        previousDoc: previousSlug ? { id: doc.id, slug: previousSlug, _status: 'published' } : undefined,
        logger: req.payload.logger,
      })
    }
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook<T> = ({ doc, id, req }) => {
    if (req.context.disableRevalidate) return doc

    const previous = takeSnapshot(req, id)
    for (const locale of CONTENT_LOCALES) {
      if (!previous[locale]) continue
      executeCollectionDeleteRevalidation({
        collection,
        locale,
        doc: { id, slug: previous[locale], _status: 'published' },
        logger: req.payload.logger,
      })
    }
    return doc
  }

  return { beforeOperation, beforeChange, beforeDelete, afterChange, afterDelete }
}
