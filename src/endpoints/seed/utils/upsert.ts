import type { CollectionSlug, Payload } from 'payload'

export type UpsertResult = { created: boolean; updated: boolean }

function hasStableId<T extends Record<string, unknown>>(data: T): data is T & { stableId: string } {
  const value = (data as { stableId?: unknown }).stableId
  return typeof value === 'string' && value.length > 0
}

export async function upsertByStableId<T extends Record<string, unknown>>(
  payload: Payload,
  collection: CollectionSlug,
  data: T,
  options?: { filePath?: string; context?: Record<string, unknown>; req?: Partial<import('payload').PayloadRequest> },
): Promise<UpsertResult> {
  if (!hasStableId(data)) {
    throw new Error(`Missing stableId for ${collection} upsert`)
  }

  const stableId = data.stableId
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
      context: { disableRevalidate: true, disableSearchSync: true, ...(options?.context ?? {}) },
      ...(options?.req ? { req: options.req } : {}),
      ...(options?.filePath ? { filePath: options.filePath } : {}),
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
    context: { disableRevalidate: true, disableSearchSync: true, ...(options?.context ?? {}) },
    ...(options?.req ? { req: options.req } : {}),
    ...(options?.filePath ? { filePath: options.filePath } : {}),
  })
  return { created: false, updated: true }
}
