import type { CollectionSlug, Payload, PayloadRequest } from 'payload'

export type UpsertResult = { created: boolean; updated: boolean }

function buildOperationReq(
  req: Partial<PayloadRequest> | undefined,
  context: Record<string, unknown>,
): Partial<PayloadRequest> {
  return {
    ...(req ?? {}),
    context: {
      ...((req?.context as Record<string, unknown> | undefined) ?? {}),
      ...context,
    },
  }
}

function hasStableId<T extends Record<string, unknown>>(data: T): data is T & { stableId: string } {
  const value = (data as { stableId?: unknown }).stableId
  return typeof value === 'string' && value.length > 0
}

type S3LikeError = {
  name?: unknown
  Code?: unknown
  message?: unknown
  Resource?: unknown
}

function parseMissingResourceFromMessage(message: string): string | null {
  const match = /Resource":"([^"]+)"/.exec(message)
  return match?.[1] ?? null
}

function resolveMissingS3Key(error: unknown): string | null {
  const bucket = process.env.S3_BUCKET || ''
  if (!bucket) return null

  const candidates: S3LikeError[] = []
  if (error && typeof error === 'object') {
    candidates.push(error as S3LikeError)

    const cause = (error as { cause?: unknown }).cause
    if (cause && typeof cause === 'object') {
      candidates.push(cause as S3LikeError)
    }

    const nestedErr = (error as { err?: unknown }).err
    if (nestedErr && typeof nestedErr === 'object') {
      candidates.push(nestedErr as S3LikeError)
    }
  }

  for (const candidate of candidates) {
    const name = typeof candidate.name === 'string' ? candidate.name : ''
    const code = typeof candidate.Code === 'string' ? candidate.Code : ''
    const message = typeof candidate.message === 'string' ? candidate.message : ''
    const resourceRaw =
      typeof candidate.Resource === 'string'
        ? candidate.Resource
        : message
          ? parseMissingResourceFromMessage(message)
          : null

    const isNoSuchKey = name === 'NoSuchKey' || code === 'NoSuchKey' || /NoSuchKey|Object not found/i.test(message)
    if (!isNoSuchKey || !resourceRaw) continue

    const resource = resourceRaw.replace(/^\/+/, '')
    if (resource.startsWith(`${bucket}/`)) {
      return resource.slice(bucket.length + 1)
    }
    return resource
  }

  return null
}

async function updateWithNoSuchKeyRecovery(
  payload: Payload,
  params: {
    collection: CollectionSlug
    id: string | number
    data: Record<string, unknown>
    context: Record<string, unknown>
    req: Partial<PayloadRequest>
    filePath?: string
  },
) {
  const maxRetries = 3

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      await payload.update({
        collection: params.collection,
        id: params.id,
        data: params.data,
        trash: true,
        overrideAccess: true,
        context: params.context,
        req: params.req,
        ...(params.filePath ? { filePath: params.filePath } : {}),
      })
      return
    } catch (error) {
      const missingKey = params.filePath ? resolveMissingS3Key(error) : null
      if (!missingKey || !params.filePath || attempt === maxRetries) {
        throw error
      }
      // If the previous object key is missing in S3/MinIO, retry once without
      // replacing the file. This keeps seed runs idempotent instead of failing
      // due to stale object references in shared buckets.
      payload.logger.warn(`Seed media update fallback for missing object key: ${missingKey}`)
      await payload.update({
        collection: params.collection,
        id: params.id,
        data: params.data,
        trash: true,
        overrideAccess: true,
        context: params.context,
        req: params.req,
      })
      return
    }
  }
}

export async function upsertByStableId<T extends Record<string, unknown>>(
  payload: Payload,
  collection: CollectionSlug,
  data: T,
  options?: { filePath?: string; context?: Record<string, unknown>; req?: Partial<PayloadRequest> },
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

  const operationContext = { disableRevalidate: true, disableSearchSync: true, ...(options?.context ?? {}) }
  const operationReq = buildOperationReq(options?.req, operationContext)

  if (existing.totalDocs === 0) {
    await payload.create({
      collection,
      data,
      overrideAccess: true,
      context: operationContext,
      req: operationReq,
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

  await updateWithNoSuchKeyRecovery(payload, {
    collection,
    id: current.id,
    data: nextData,
    context: operationContext,
    req: operationReq,
    filePath: options?.filePath,
  })
  return { created: false, updated: true }
}
