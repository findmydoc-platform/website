import type { CollectionSlug, Payload } from 'payload'

export type CleanupTask = {
  collection: CollectionSlug
  ids: Array<number | string>
}

// Shared cleanup helper for integration tests with tracked created ids.
// Tasks run in caller-defined order to preserve collection dependency cleanup.
export async function cleanupTrackedDocs(payload: Payload, tasks: CleanupTask[]): Promise<void> {
  for (const task of tasks) {
    while (task.ids.length) {
      const id = task.ids.pop()
      if (id === undefined) continue

      await payload.delete({
        collection: task.collection,
        id,
        overrideAccess: true,
      })
    }
  }
}
