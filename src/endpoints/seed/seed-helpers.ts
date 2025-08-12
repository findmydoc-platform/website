import type { File, Payload } from 'payload'

/**
 * Fetch an image/file from a remote URL and adapt it to a Payload `File` object.
 * @param url Remote file URL
 * @returns File-like object suitable for `payload.create({ file })`
 * @throws when network request fails
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
 * Create (upload) a media document by downloading from a URL.
 * @param payload Payload instance
 * @param url Remote file URL
 * @param alt Alt text
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
 * Generic sequential seeding utility (ordered, not parallel).
 * @param payload Payload instance
 * @param collection Collection slug (informational only – creation handled in itemCreator)
 * @param items Data items
 * @param itemCreator Async creator returning created doc per item
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

/**
 * Upsert a document by a unique field.
 * @param payload Payload instance
 * @param collection Collection slug
 * @param field Unique field name
 * @param data Data to create/update
 * @returns created/updated flags and resulting doc
 */
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

/**
 * Delete all documents from the given collections (demo reset only).
 * Performs best‑effort cleanup (continues on errors) and small batch deletes.
 * @param payload Payload instance
 * @param collections Ordered list (children first) to avoid FK issues
 * @param opts.disableRevalidate Disable revalidation context flag
 */
export async function clearCollections(
  payload: Payload,
  collections: string[],
  opts: { disableRevalidate?: boolean } = {},
): Promise<void> {
  for (const c of collections) {
    payload.logger.info(`— Clearing collection (demo reset): ${c}`)
    try {
      // Preferences cleanup (ignore failures)
      try {
        await payload.delete({
          collection: 'payload-preferences',
          where: {
            key: { like: `collection-${c}-%` },
          },
          overrideAccess: true,
        })
      } catch (prefErr) {
        payload.logger.debug(`Could not clear preferences for ${c}: ${(prefErr as Error).message}`)
      }

      const docs = await payload.find({
        collection: c as any,
        limit: 1000,
        overrideAccess: true,
      })

      if (docs.docs.length === 0) {
        payload.logger.info(`— Collection ${c} is already empty`)
        continue
      }

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
