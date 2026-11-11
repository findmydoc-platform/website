import type { CollectionSlug, Payload } from 'payload'

export type CleanupTask = {
  collection: CollectionSlug
  ids: Array<number | string>
}

export async function clearTrackedDoctorImageReferences(payload: Payload, mediaIds: Array<number>): Promise<void> {
  if (!mediaIds.length) return
  const doctors = await payload.find({
    collection: 'doctors',
    where: { profileImage: { in: mediaIds } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    trash: true,
  })
  for (const doctor of doctors.docs) {
    await payload.update({
      collection: 'doctors',
      id: doctor.id,
      data: { profileImage: null },
      overrideAccess: true,
      trash: true,
    })
  }
}

// Shared cleanup helper for integration tests with tracked created ids.
// Tasks run in caller-defined order to preserve collection dependency cleanup.
export async function cleanupTrackedDocs(payload: Payload, tasks: CleanupTask[]): Promise<void> {
  for (const task of tasks) {
    while (task.ids.length) {
      const id = task.ids.pop()
      if (id === undefined) continue

      try {
        await payload.delete({
          collection: task.collection,
          id,
          overrideAccess: true,
        })
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) continue
        throw error
      }
    }
  }
}
