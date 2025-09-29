import {
  buildNestedFilename,
  buildStoragePath,
  extractRelationId,
  getBaseFilename,
  resolveDocumentId,
  resolveFilenameSource,
  sanitizePathSegment,
} from '@/collections/common/mediaPathHelpers'
import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Computes a storage path and nested filename for media documents using an owner relation and a folder key.
 *
 * Inputs:
 * - ownerField: name of the relation field whose id becomes the first subfolder (e.g., 'clinic').
 * - key: either the document id (`{ type: 'docId' }`) or another field like `storageKey` (`{ type: 'field', name: 'storageKey' }`).
 * - storagePrefix: top-level prefix, e.g. 'clinics' or 'clinics-gallery'.
 * - overwriteFilename: predicate deciding when to write nested filename to `draft.filename`.
 *
 * Behavior:
 * - On create: throws if owner, key, or filename cannot be resolved.
 * - On update: returns previous storagePath if inputs are missing.
 * - Returns `{ filename?, storagePath? }` where fields are omitted when not changed.
 */
export function computeStorage({
  operation,
  draft,
  originalDoc,
  req,
  ownerField = 'clinic',
  key,
  storagePrefix,
  overwriteFilename = (op: 'create' | 'update', d: any) => op === 'create' || typeof d?.filename === 'string',
}: {
  operation: 'create' | 'update'
  draft: any
  originalDoc?: any
  req?: any
  ownerField?: string
  key: { type: 'field'; name: string } | { type: 'docId' }
  storagePrefix: string
  overwriteFilename?: (op: 'create' | 'update', draft: any) => boolean
}): { filename?: string; storagePath?: string } {
  const owner = sanitizePathSegment(
    extractRelationId(draft?.[ownerField]) ?? extractRelationId(originalDoc?.[ownerField]),
  )

  const folderKey =
    key.type === 'field'
      ? sanitizePathSegment(draft?.[key.name] ?? originalDoc?.[key.name])
      : resolveDocumentId({ operation, data: draft, originalDoc, req })

  const filenameSource = resolveFilenameSource({
    req,
    draftFilename: draft?.filename,
    originalFilename: originalDoc?.filename,
  })
  const base = getBaseFilename(filenameSource)

  const fallback = typeof draft?.storagePath === 'string' ? draft.storagePath : originalDoc?.storagePath

  if (!owner || !folderKey || !base) {
    if (operation === 'create') {
      if (!owner) throw new Error('Unable to resolve owner for media upload')
      if (!folderKey) throw new Error('Unable to resolve folder key for media upload')
      if (!base) throw new Error('Unable to resolve filename for media upload')
    }
    return fallback ? { storagePath: fallback } : {}
  }

  const nestedFilename = buildNestedFilename(owner, folderKey, base)
  const storagePath = buildStoragePath(storagePrefix, owner, folderKey, base)

  return {
    filename: overwriteFilename(operation, draft) ? nestedFilename : undefined,
    storagePath,
  }
}

/**
 * Reusable beforeChange hook to compute storage fields for media-like collections.
 */
export function beforeChangeComputeStorage(options: {
  ownerField?: string
  key: { type: 'field'; name: string } | { type: 'docId' }
  storagePrefix: string
  overwriteFilename?: (op: 'create' | 'update', draft: any) => boolean
}): CollectionBeforeChangeHook<any> {
  const { ownerField = 'clinic', key, storagePrefix, overwriteFilename } = options
  return async ({ data, originalDoc, operation, req }) => {
    const draft: any = { ...(data || {}) }
    const { filename, storagePath } = computeStorage({
      operation,
      draft,
      originalDoc,
      req,
      ownerField,
      key,
      storagePrefix,
      overwriteFilename,
    })
    if (filename !== undefined) draft.filename = filename
    if (storagePath !== undefined) draft.storagePath = storagePath
    return draft
  }
}
