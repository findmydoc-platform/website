import type { Payload, PayloadRequest } from 'payload'

type MediaCollectionSlug = 'clinicMedia' | 'doctorMedia' | 'platformContentMedia' | 'userProfileMedia'

type MediaDocument = {
  id: number
  url?: string | null
  alt?: string | null
  filename?: string | null
}

export type MediaDescriptor = {
  url: string | null
  alt: string | null
}

function buildMediaFileUrl(collection: MediaCollectionSlug, filename: string | null | undefined): string | null {
  if (!filename || filename.trim().length === 0) return null
  return `/api/${collection}/file/${filename}`
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []

  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export function extractMediaRelationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const relation = value as { id?: unknown }
    return extractMediaRelationId(relation.id)
  }

  return null
}

export function getMediaDescriptorFromRelation(value: unknown): MediaDescriptor | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (!('url' in value)) return undefined

  const relation = value as { url?: unknown; alt?: unknown }
  const url = typeof relation.url === 'string' ? relation.url : null
  const alt = typeof relation.alt === 'string' ? relation.alt : null

  if (!url && !alt) return undefined
  return { url, alt }
}

export async function resolveMediaDescriptorFromRelation({
  payload,
  collection,
  relation,
  req,
  overrideAccess = true,
}: {
  payload: Payload
  collection: MediaCollectionSlug
  relation: unknown
  req?: PayloadRequest
  overrideAccess?: boolean
}): Promise<MediaDescriptor | undefined> {
  const relationDescriptor = getMediaDescriptorFromRelation(relation)
  if (relationDescriptor?.url) {
    return relationDescriptor
  }

  const relationId = extractMediaRelationId(relation)
  if (!relationId) {
    return relationDescriptor
  }

  try {
    const media = (await payload.findByID({
      collection,
      id: relationId,
      depth: 0,
      overrideAccess,
      req,
    })) as MediaDocument

    return {
      url: typeof media.url === 'string' ? media.url : buildMediaFileUrl(collection, media.filename),
      alt: typeof media.alt === 'string' ? media.alt : null,
    }
  } catch {
    return relationDescriptor
  }
}

export async function findMediaDescriptorsByIds({
  payload,
  collection,
  ids,
  req,
  overrideAccess = true,
  chunkSize = 200,
  pageSize = 500,
}: {
  payload: Payload
  collection: MediaCollectionSlug
  ids: number[]
  req?: PayloadRequest
  overrideAccess?: boolean
  chunkSize?: number
  pageSize?: number
}): Promise<Map<number, MediaDescriptor>> {
  const descriptorsById = new Map<number, MediaDescriptor>()
  if (ids.length === 0) return descriptorsById

  const idChunks = chunkArray(Array.from(new Set(ids)), chunkSize)

  for (const idChunk of idChunks) {
    let page = 1
    while (true) {
      const result = await payload.find({
        collection,
        depth: 0,
        page,
        limit: pageSize,
        pagination: true,
        overrideAccess,
        req,
        where: {
          id: {
            in: idChunk,
          },
        },
      })

      const docs = result.docs as MediaDocument[]
      docs.forEach((doc) => {
        descriptorsById.set(doc.id, {
          url: typeof doc.url === 'string' ? doc.url : buildMediaFileUrl(collection, doc.filename),
          alt: typeof doc.alt === 'string' ? doc.alt : null,
        })
      })

      if (!result.hasNextPage) break
      page += 1
    }
  }

  return descriptorsById
}
