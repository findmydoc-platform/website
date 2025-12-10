import type { File, Payload, CollectionSlug } from 'payload'

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

interface UploadFromURLArgs<TData = Record<string, unknown>> {
  collection: string
  url: string
  data: TData
}

/**
 * Create (upload) a media document by downloading from a URL.
 * @param payload Payload instance
 * @param args Upload instructions including collection, URL, and document data
 */
export async function createMediaFromURL<TDoc = Record<string, unknown>>(
  payload: Payload,
  args: UploadFromURLArgs,
): Promise<TDoc> {
  const { url, collection, data } = args
  const fileBuffer = await fetchFileByURL(url)

  return payload.create({
    collection: collection as CollectionSlug,
    data,
    file: fileBuffer,
  }) as TDoc
}

/**
 * Convert plain text to richText (Lexical) format for PayloadCMS.
 * @param text Plain text string
 * @returns Lexical editor format object
 */
export function textToRichText(text: string): Record<string, unknown> {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text,
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

/**
 * Generic sequential seeding utility (ordered, not parallel).
 * @param payload Payload instance
 * @param collection Collection slug (informational only – creation handled in itemCreator)
 * @param items Data items
 * @param itemCreator Async creator returning created doc per item
 */
export async function seedCollection<TItem, TResult = unknown>(
  payload: Payload,
  collection: string,
  items: TItem[],
  itemCreator: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = []

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
export async function upsertByUniqueField<TDoc extends object, TData extends object = TDoc>(
  payload: Payload,
  collection: string,
  field: string,
  data: TData,
): Promise<{ doc: TDoc; created: boolean; updated: boolean }> {
  const value = (data as Record<string, unknown>)[field]
  if (value == null) throw new Error(`upsertByUniqueField: missing field ${field}`)

  const existing = await payload.find({
    collection: collection as CollectionSlug,
    limit: 1,
    where: { [field]: { equals: value } },
  })

  if (existing.totalDocs === 0) {
    const doc = (await payload.create({ collection: collection as CollectionSlug, data })) as TDoc
    return { doc, created: true, updated: false }
  }

  const current = existing.docs[0]!
  const doc = (await payload.update({ collection: collection as CollectionSlug, id: current.id, data })) as TDoc
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
          collection: 'payload-preferences' as CollectionSlug,
          where: {
            key: { like: `collection-${c}-%` },
          },
          overrideAccess: true,
        })
      } catch (prefErr) {
        payload.logger.debug(`Could not clear preferences for ${c}: ${(prefErr as Error).message}`)
      }

      const docs = await payload.find({
        collection: c as CollectionSlug,
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
                collection: c as CollectionSlug,
                id: doc.id,
                context: opts.disableRevalidate ? { disableRevalidate: true } : undefined,
                overrideAccess: true,
              })
              deletedCount++
            } catch (deleteErr: unknown) {
              const msg = deleteErr instanceof Error ? deleteErr.message : String(deleteErr)
              payload.logger.warn(`Failed to delete ${c} document ${doc.id}: ${msg}`)
            }
          }),
        )
      }

      payload.logger.info(`— Cleared ${deletedCount}/${docs.docs.length} documents from ${c}`)
    } catch (e: unknown) {
      payload.logger.error(e, `Failed clearing collection ${c}`)
    }
  }
}
