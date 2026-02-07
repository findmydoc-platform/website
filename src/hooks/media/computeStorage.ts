import crypto from 'crypto'
import {
  buildNestedFilename,
  buildStoragePath,
  extractRelationId,
  getBaseFilename,
  resolveDocumentId,
  resolveFilenameSource,
  sanitizePathSegment,
} from '@/collections/common/mediaPathHelpers'
import { extractFileSizeFromRequest } from '@/utilities/requestFileUtils'
import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'

/**
 * Returns a short deterministic hash used when storage keys must be derived.
 */
function shortHash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 10)
}

/**
 * Computes a storage path and nested filename for media documents using an owner relation and a folder key.
 *
 * Inputs:
 * - ownerField: name of the relation field whose id becomes the first subfolder (e.g., 'clinic').
 * - key: either the document id (`{ type: 'docId' }`) or another field like `storageKey` (`{ type: 'field', name: 'storageKey' }`).
 * - storagePrefix: top-level prefix, e.g. 'clinics' or 'clinics-gallery'.
 * - overwriteFilename: predicate deciding when to write nested filename to `draft.filename`.
 * - ownerRequired: defaults to `true`. Set to `false` for collections without an owner relation.
 *
 * Behavior:
 * - On create: throws if required values (owner when `ownerRequired`, folder key, filename) cannot be resolved.
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
  overwriteFilename,
  ownerRequired = true,
}: {
  operation: 'create' | 'update'
  draft: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  req?: PayloadRequest
  ownerField?: string
  key: { type: 'field'; name: string } | { type: 'docId' } | { type: 'hash' }
  storagePrefix: string
  overwriteFilename?: (op: 'create' | 'update', draft: Record<string, unknown>) => boolean
  ownerRequired?: boolean
}): { filename?: string; storagePath?: string } {
  const incomingFileSize = extractFileSizeFromRequest(req)
  const hasIncomingUpload = Boolean(incomingFileSize)

  type RelationInput = Parameters<typeof extractRelationId>[0]

  const ownerRelation =
    extractRelationId((draft as Record<string, unknown>)?.[ownerField] as RelationInput) ??
    extractRelationId((originalDoc as Record<string, unknown> | undefined)?.[ownerField] as RelationInput)
  const owner = sanitizePathSegment(ownerRelation as string | number | null | undefined)

  const filenameSource = resolveFilenameSource({
    req: (req as unknown as Record<string, unknown> | null) ?? null,
    draftFilename: draft?.filename as string | undefined,
    originalFilename: (originalDoc as Record<string, unknown> | undefined)?.filename as string | undefined,
  })
  const base = getBaseFilename(filenameSource)

  let folderKey: string | null = null
  let keySource: 'field' | 'docId' | 'hash' | 'derived-hash' | 'unknown' = 'unknown'

  if (key.type === 'field') {
    const rawFolderKey =
      (draft as Record<string, unknown>)?.[key.name] ?? (originalDoc as Record<string, unknown> | undefined)?.[key.name]
    folderKey = sanitizePathSegment(rawFolderKey as string | number | null | undefined)
    keySource = folderKey ? 'field' : 'derived-hash'
  } else if (key.type === 'docId') {
    folderKey = resolveDocumentId({
      operation,
      data: draft as Record<string, unknown>,
      originalDoc: originalDoc as Record<string, unknown> | undefined,
      req: req as unknown as Record<string, unknown>,
    })
    keySource = folderKey ? 'docId' : 'derived-hash'
  } else if (key.type === 'hash') {
    if (operation === 'update' && !hasIncomingUpload) {
      const existingStoragePath =
        typeof draft?.storagePath === 'string'
          ? draft.storagePath
          : typeof originalDoc?.storagePath === 'string'
            ? originalDoc.storagePath
            : null

      return existingStoragePath ? { storagePath: existingStoragePath } : {}
    }

    // Always derive a hash-based folder key
    const ownerSegment = owner ?? 'platform'
    const filenameSegment = base ?? 'unknown'
    const raw = `${ownerSegment}:${filenameSegment}${incomingFileSize ? `:${incomingFileSize}` : ''}`
    folderKey = shortHash(raw)
    keySource = 'hash'
  }

  // Ensure a stable key even when the configured source is missing.
  if (!folderKey && operation === 'create') {
    const ownerSegment = owner ?? 'platform'
    const filenameSegment = base ?? 'unknown'
    const raw = `${ownerSegment}:${filenameSegment}${incomingFileSize ? `:${incomingFileSize}` : ''}`
    folderKey = shortHash(raw)
    keySource = 'derived-hash'
  }

  const fallback = typeof draft?.storagePath === 'string' ? draft.storagePath : originalDoc?.storagePath

  if ((ownerRequired && !owner) || !folderKey || !base) {
    if (operation === 'create') {
      if (ownerRequired && !owner) throw new Error('Unable to resolve owner for media upload')
      if (!folderKey) throw new Error('Unable to resolve folder key for media upload')
      if (!base) throw new Error('Unable to resolve filename for media upload')
    }
    return fallback ? { storagePath: fallback as string } : {}
  }

  const nestedFilename = buildNestedFilename(owner, folderKey, base)
  const storagePath = buildStoragePath(storagePrefix, owner, folderKey, base)

  try {
    req?.payload.logger.debug({
      msg: 'computeStorage:derived-path',
      storagePrefix,
      ownerField,
      owner,
      baseFilename: base,
      derivedKey: folderKey,
      nestedFilename,
      storagePath,
      keySource,
      operation,
    })
  } catch (_error) {
    // best-effort logging only
  }

  const shouldOverwrite =
    typeof overwriteFilename === 'function'
      ? overwriteFilename(operation, draft)
      : operation === 'create' || hasIncomingUpload

  return {
    filename: shouldOverwrite ? nestedFilename : undefined,
    storagePath,
  }
}

/**
 * Reusable beforeChange hook to compute storage fields for media-like collections.
 */
export function beforeChangeComputeStorage(options: {
  ownerField?: string
  key: { type: 'field'; name: string } | { type: 'docId' } | { type: 'hash' }
  storagePrefix: string
  overwriteFilename?: (op: 'create' | 'update', draft: Record<string, unknown>) => boolean
  ownerRequired?: boolean
}): CollectionBeforeChangeHook {
  const { ownerField = 'clinic', key, storagePrefix, overwriteFilename, ownerRequired } = options
  return async ({ data, originalDoc, operation, req }) => {
    const draft = { ...(data || {}) }
    const { filename, storagePath } = computeStorage({
      operation,
      draft,
      originalDoc,
      req,
      ownerField,
      key,
      storagePrefix,
      overwriteFilename,
      ownerRequired,
    })
    if (filename !== undefined) draft.filename = filename
    if (storagePath !== undefined) draft.storagePath = storagePath
    return draft
  }
}
