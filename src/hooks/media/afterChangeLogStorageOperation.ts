import type { CollectionAfterChangeHook } from 'payload'

export function afterChangeLogStorageOperation(collection: string): CollectionAfterChangeHook {
  return async ({ doc, operation, previousDoc, req }) => {
    try {
      req.payload.logger.debug(
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
