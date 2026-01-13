import type { CollectionSlug, Payload } from 'payload'

export type UpsertResult = { created: boolean; updated: boolean }

export async function upsertByStableId<T extends Record<string, unknown>>(
  payload: Payload,
  collection: CollectionSlug,
  data: T,
): Promise<UpsertResult> {
  const stableId = data.stableId
  if (typeof stableId !== 'string' || stableId.length === 0) {
    throw new Error(`Missing stableId for ${collection} upsert`)
  }

  const existing = await payload.find({
    collection,
    where: { stableId: { equals: stableId } },
    limit: 1,
    // If the document was soft-deleted (Trash), it may still exist and still
    // hold a unique stableId. Include trashed docs so we update/restore instead
    // of trying to create a duplicate that would violate unique constraints.
    trash: true,
    overrideAccess: true,
  })

  if (existing.totalDocs === 0) {
    await payload.create({
      collection,
      data,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    return { created: true, updated: false }
  }

  const current = existing.docs[0] as { id: string | number; deletedAt?: unknown }
  const nextData: Record<string, unknown> = { ...data }

  // If found doc is trashed, restore it by clearing deletedAt.
  if (current.deletedAt) {
    nextData.deletedAt = null
  }

  await payload.update({
    collection,
    id: current.id,
    data: nextData,
    trash: true,
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
  return { created: false, updated: true }
}
