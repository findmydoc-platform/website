import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
  TypeWithID,
} from 'payload'

import {
  executeCollectionChangeRevalidation,
  executeCollectionDeleteRevalidation,
} from '@/hooks/cacheRevalidationAdapters'
import { CONTENT_LOCALES, type ContentLocale } from '@/utilities/contentLocalization'

type Collection = 'pages' | 'posts'
type PublishedSlugs = Partial<Record<ContentLocale, string>>
type DocumentId = TypeWithID['id']

export function localizedPublicationRevalidation<T extends TypeWithID>(collection: Collection) {
  const previousPublishedSlugsKey = `${collection}PublicSlugsBeforeMutation`
  const draftSaveKey = `${collection}DraftSave`

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

  const isDraftSave = (context: PayloadRequest['context']): boolean => context[draftSaveKey] === true

  const beforeOperation: CollectionBeforeOperationHook = ({ args, operation, req }) => {
    if (operation === 'update') {
      req.context[draftSaveKey] = args.draft === true && args.unpublishAllLocales !== true
    }
    return args
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

  const afterChange: CollectionAfterChangeHook<T> = async ({ doc, req }) => {
    if (req.context.disableRevalidate || isDraftSave(req.context)) return doc

    const before = takeSnapshot(req, doc.id)
    const after = await getPublishedSlugs(req, doc.id)
    for (const locale of CONTENT_LOCALES) {
      if (!before[locale] && !after[locale]) continue
      executeCollectionChangeRevalidation({
        collection,
        locale,
        doc: { id: doc.id, slug: after[locale], _status: after[locale] ? 'published' : 'draft' },
        previousDoc: before[locale] ? { id: doc.id, slug: before[locale], _status: 'published' } : undefined,
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

  return { isDraftSave, beforeOperation, beforeChange, beforeDelete, afterChange, afterDelete }
}
