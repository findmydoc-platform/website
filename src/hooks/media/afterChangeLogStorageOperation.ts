import type { CollectionAfterChangeHook } from 'payload'

export function afterChangeLogStorageOperation(collection: string): CollectionAfterChangeHook {
  return async ({ doc, operation, previousDoc, req }) => {
    if (process.env.STORAGE_DIAGNOSTICS !== 'true') return doc

    try {
      req.payload.logger.info(
        {
          collection,
          docId: doc?.id,
          filename: doc?.filename,
          operation,
          previousStoragePath: previousDoc?.storagePath,
          storagePath: doc?.storagePath,
        },
        'storage:document-persisted',
      )
    } catch (_error) {
      // Diagnostics are best effort only and must never block uploads.
    }

    return doc
  }
}
