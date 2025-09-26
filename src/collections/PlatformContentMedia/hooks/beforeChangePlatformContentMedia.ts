import type { CollectionBeforeChangeHook } from 'payload'
import { buildNestedFilename, buildStoragePath, getBaseFilename, resolveDocumentId } from '@/collections/common/mediaPathHelpers'

export const beforeChangePlatformContentMedia: CollectionBeforeChangeHook<any> = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  const draft: any = { ...(data || {}) }

  if (operation === 'create' && req.user && req.user.collection === 'basicUsers') {
    draft.createdBy = draft.createdBy ?? req.user.id
  }

  const docId = resolveDocumentId({ operation, data: draft, originalDoc, req })
  const filenameSource =
    typeof draft.filename === 'string' ? draft.filename : (originalDoc as any)?.filename ?? undefined
  const baseFilename = getBaseFilename(filenameSource)

  if (!docId) {
    if (operation === 'create') {
      throw new Error('Unable to resolve document identifier for platform media upload')
    }
    draft.storagePath = draft.storagePath ?? (originalDoc as any)?.storagePath
    return draft
  }

  if (!baseFilename) {
    if (operation === 'create') {
      throw new Error('Unable to resolve filename for platform media upload')
    }
    draft.storagePath = draft.storagePath ?? (originalDoc as any)?.storagePath
    return draft
  }

  const nestedFilename = buildNestedFilename(null, docId, baseFilename)
  const storagePath = buildStoragePath('platform', null, docId, baseFilename)

  if (operation === 'create' || typeof draft.filename === 'string') {
    draft.filename = nestedFilename
  }

  draft.storagePath = storagePath

  return draft
}
