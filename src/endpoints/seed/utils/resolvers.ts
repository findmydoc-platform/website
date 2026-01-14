import type { CollectionSlug, Payload } from 'payload'

type StableIdCache = Map<CollectionSlug, Map<string, string | number | null>>
type IdCache = Map<CollectionSlug, Map<string | number, string>>

export type StableIdResolvers = {
  resolveIdByStableId: (collection: CollectionSlug, stableId: string) => Promise<string | number | null>
  resolveManyIdsByStableIds: (
    collection: CollectionSlug,
    stableIds: string[],
  ) => Promise<{ ids: Array<string | number>; missing: string[] }>
  resolveStableIdById: (collection: CollectionSlug, id: string | number) => Promise<string | null>
  resolveManyStableIdsByIds: (
    collection: CollectionSlug,
    ids: Array<string | number>,
  ) => Promise<{ stableIds: string[]; missing: Array<string | number> }>
}

function ensureStableIdCache(cache: StableIdCache, collection: CollectionSlug) {
  if (!cache.has(collection)) {
    cache.set(collection, new Map())
  }
  return cache.get(collection) as Map<string, string | number | null>
}

function ensureIdCache(cache: IdCache, collection: CollectionSlug) {
  if (!cache.has(collection)) {
    cache.set(collection, new Map())
  }
  return cache.get(collection) as Map<string | number, string>
}

export function createStableIdResolvers(payload: Payload): StableIdResolvers {
  const idsByStableId: StableIdCache = new Map()
  const stableIdsById: IdCache = new Map()

  const resolveIdByStableId = async (collection: CollectionSlug, stableId: string) => {
    const collectionCache = ensureStableIdCache(idsByStableId, collection)
    if (collectionCache.has(stableId)) {
      return collectionCache.get(stableId) ?? null
    }

    const result = await payload.find({
      collection,
      where: { stableId: { equals: stableId } },
      limit: 1,
      overrideAccess: true,
    })

    const doc = result.docs[0] as Record<string, unknown> | undefined
    const id = doc?.id as string | number | undefined
    if (id == null) {
      collectionCache.set(stableId, null)
      return null
    }

    collectionCache.set(stableId, id)
    const idCache = ensureIdCache(stableIdsById, collection)
    idCache.set(id, stableId)
    return id
  }

  const resolveManyIdsByStableIds = async (collection: CollectionSlug, stableIds: string[]) => {
    const ids: Array<string | number> = []
    const missing: string[] = []

    for (const stableId of stableIds) {
      const id = await resolveIdByStableId(collection, stableId)
      if (id == null) {
        missing.push(stableId)
      } else {
        ids.push(id)
      }
    }

    return { ids, missing }
  }

  const resolveStableIdById = async (collection: CollectionSlug, id: string | number) => {
    const idCache = ensureIdCache(stableIdsById, collection)
    if (idCache.has(id)) {
      return idCache.get(id) ?? null
    }

    let doc: unknown

    try {
      doc = await payload.findByID({
        collection,
        id,
        overrideAccess: true,
      })
    } catch (error) {
      const err = error as { status?: number; statusCode?: number; name?: string; message?: string }
      const message = typeof err.message === 'string' ? err.message.toLowerCase() : ''
      const isNotFound =
        err.status === 404 ||
        err.statusCode === 404 ||
        err.name === 'NotFound' ||
        message.includes('not found')
      if (!isNotFound) {
        payload.logger.error(error, `Error resolving ${collection} by id ${id}`)
        throw error
      }
      doc = undefined
    }

    const stableId =
      doc && typeof doc === 'object' && 'stableId' in doc && typeof (doc as { stableId: unknown }).stableId === 'string'
        ? (doc as { stableId: string }).stableId
        : null
    if (stableId) {
      const collectionCache = ensureStableIdCache(idsByStableId, collection)
      collectionCache.set(stableId, id)
      idCache.set(id, stableId)
    }

    return stableId
  }

  const resolveManyStableIdsByIds = async (collection: CollectionSlug, ids: Array<string | number>) => {
    const stableIds: string[] = []
    const missing: Array<string | number> = []

    for (const id of ids) {
      const stableId = await resolveStableIdById(collection, id)
      if (!stableId) {
        missing.push(id)
      } else {
        stableIds.push(stableId)
      }
    }

    return { stableIds, missing }
  }

  return {
    resolveIdByStableId,
    resolveManyIdsByStableIds,
    resolveStableIdById,
    resolveManyStableIdsByIds,
  }
}
