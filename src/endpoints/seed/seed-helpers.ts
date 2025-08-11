import type { File, Payload } from 'payload'

/**
 * Fetches an image from a URL and returns it as a File object that can be used with Payload
 */
export async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }

  const data = await res.arrayBuffer()

  return {
    name: url.split('/').pop() || `file-${Date.now()}`,
    data: Buffer.from(data),
    mimetype: `image/${url.split('.').pop()}`,
    size: data.byteLength,
  }
}

/**
 * Creates a media document from a URL
 */
export async function createMediaFromURL(payload: Payload, url: string, alt: string): Promise<any> {
  const fileBuffer = await fetchFileByURL(url)

  return payload.create({
    collection: 'media',
    data: { alt },
    file: fileBuffer,
  })
}

/**
 * Generic function to seed a collection with multiple items
 */
export async function seedCollection<T>(
  payload: Payload,
  collection: string,
  items: T[],
  itemCreator: (item: T, index: number) => Promise<any>,
): Promise<any[]> {
  const results = []

  for (let i = 0; i < items.length; i++) {
    const result = await itemCreator(items[i]!, i)
    results.push(result)
  }

  return results
}

/** Upsert a document by a unique text field (simple implementation). */
export async function upsertByUniqueField<T extends Record<string, any>>(
  payload: Payload,
  collection: string,
  field: string,
  data: T,
): Promise<{ doc: any; created: boolean; updated: boolean }> {
  const value = data[field]
  if (value == null) throw new Error(`upsertByUniqueField: missing field ${field}`)
  const existing = await payload.find({
    collection: collection as any,
    limit: 1,
    where: { [field]: { equals: value } },
  })
  if (existing.totalDocs === 0) {
    const doc = await payload.create({ collection: collection as any, data })
    return { doc, created: true, updated: false }
  }
  const current = existing.docs[0]!
  const doc = await payload.update({ collection: collection as any, id: current.id, data })
  return { doc, created: false, updated: true }
}

/** Clear all documents from provided collections (demo-only usage). */
export async function clearCollections(
  payload: Payload,
  collections: string[],
  opts: { disableRevalidate?: boolean } = {},
): Promise<void> {
  for (const c of collections) {
    payload.logger.info(`— Clearing collection (demo reset): ${c}`)
    try {
      // First, try to clear any admin preferences that might reference this collection
      // This prevents the PayloadCMS preferences query error we've been seeing
      try {
        await payload.delete({
          collection: 'payload-preferences',
          where: {
            key: {
              like: `collection-${c}-%`,
            },
          },
          overrideAccess: true,
        })
      } catch (prefErr) {
        // Ignore preference clearing errors - they're not critical
        payload.logger.debug(`Could not clear preferences for ${c}: ${(prefErr as Error).message}`)
      }

      // Get all documents to delete them individually
      // This avoids issues with bulk delete and admin preferences
      const docs = await payload.find({
        collection: c as any,
        limit: 1000,
        overrideAccess: true,
      })

      if (docs.docs.length === 0) {
        payload.logger.info(`— Collection ${c} is already empty`)
        continue
      }

      // Delete documents in small batches to avoid overwhelming the database
      const batchSize = 5
      let deletedCount = 0

      for (let i = 0; i < docs.docs.length; i += batchSize) {
        const batch = docs.docs.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (doc) => {
            try {
              await payload.delete({
                collection: c as any,
                id: doc.id,
                context: opts.disableRevalidate ? { disableRevalidate: true } : undefined,
                overrideAccess: true,
              })
              deletedCount++
            } catch (deleteErr: any) {
              payload.logger.warn(`Failed to delete ${c} document ${doc.id}: ${deleteErr.message}`)
            }
          }),
        )
      }

      payload.logger.info(`— Cleared ${deletedCount}/${docs.docs.length} documents from ${c}`)
    } catch (e: any) {
      payload.logger.error(`Failed clearing collection ${c}: ${e.message}`)
    }
  }
}
