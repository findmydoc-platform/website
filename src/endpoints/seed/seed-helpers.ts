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
