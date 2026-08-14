import type { CollectionSlug, Payload, PayloadRequest, Where } from 'payload'
import { resolveS3StorageBucket } from '@/plugins/storageConfig'

export type UpsertResult = {
  created: boolean
  updated: boolean
  previousSlug?: string
  nextSlug?: string
}

export type SeedUpsertPolicy = {
  reconcileByUniqueFields?: string[]
  recreateUploadOnRelationDrift?: string[]
  skipIfCurrentMatches?: boolean
  skipIfVersionMatches?: boolean
}

type SeedVersionRecord = {
  version?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const valuesMatch = (expected: unknown, actual: unknown): boolean => {
  if (expected === null) return actual == null
  if (typeof expected === 'undefined') return true
  if (expected === false && actual == null) return true

  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((value, index) => valuesMatch(value, actual[index]))
    )
  }

  if (isRecord(expected)) {
    if (!isRecord(actual)) {
      return Object.values(expected).every((value) => valuesMatch(value, undefined))
    }

    return Object.entries(expected).every(([key, value]) => valuesMatch(value, actual[key]))
  }

  if (
    (typeof expected === 'string' || typeof expected === 'number') &&
    (typeof actual === 'string' || typeof actual === 'number')
  ) {
    return String(expected) === String(actual)
  }

  return Object.is(expected, actual)
}

async function hasMatchingVersion(
  payload: Payload,
  collection: CollectionSlug,
  parentId: string | number,
  data: Record<string, unknown>,
): Promise<boolean> {
  const findVersions = payload.findVersions as unknown as (options: {
    collection: CollectionSlug
    depth: number
    overrideAccess: boolean
    pagination: false
    where: { parent: { equals: string | number } }
  }) => Promise<{ docs: SeedVersionRecord[] }>
  const versions = await findVersions({
    collection,
    depth: 0,
    overrideAccess: true,
    pagination: false,
    where: { parent: { equals: parentId } },
  })

  return versions.docs.some((entry) => isRecord(entry.version) && valuesMatch(data, entry.version))
}

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

function cloneOperationReq(req: Partial<PayloadRequest>): Partial<PayloadRequest> {
  return {
    ...req,
    context: {
      ...((req.context as Record<string, unknown> | undefined) ?? {}),
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

type ValidationErrorLike = {
  path?: unknown
  message?: unknown
}

function parseMissingResourceFromMessage(message: string): string | null {
  const match = /Resource":"([^"]+)"/.exec(message)
  return match?.[1] ?? null
}

function resolveMissingS3Key(error: unknown): string | null {
  const bucket = resolveS3StorageBucket()

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

function readValidationErrors(error: unknown): ValidationErrorLike[] {
  if (!error || typeof error !== 'object') return []

  const fromData = (error as { data?: { errors?: unknown } }).data?.errors
  if (Array.isArray(fromData)) return fromData as ValidationErrorLike[]

  const fromTopLevel = (error as { errors?: unknown }).errors
  if (Array.isArray(fromTopLevel)) return fromTopLevel as ValidationErrorLike[]

  return []
}

function isFilenameValidationError(error: unknown): boolean {
  const errors = readValidationErrors(error)
  return errors.some((item) => item?.path === 'filename')
}

const TRANSIENT_UPLOAD_ERROR_PATTERNS = [
  /ssl\/tls alert bad record mac/i,
  /ssl routines/i,
  /socket hang up/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /request timed out/i,
  /fetch failed/i,
  /network error/i,
]

function collectErrorText(error: unknown): string {
  const queue: unknown[] = [error]
  const seen = new Set<unknown>()
  const parts: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)

    if (typeof current === 'string') {
      parts.push(current)
      continue
    }

    if (typeof current !== 'object') continue

    const candidate = current as {
      name?: unknown
      code?: unknown
      Code?: unknown
      message?: unknown
      cause?: unknown
      err?: unknown
    }

    for (const value of [candidate.name, candidate.code, candidate.Code, candidate.message]) {
      if (typeof value === 'string' && value.trim().length > 0) {
        parts.push(value)
      }
    }

    if (candidate.cause && typeof candidate.cause === 'object') {
      queue.push(candidate.cause)
    }

    if (candidate.err && typeof candidate.err === 'object') {
      queue.push(candidate.err)
    }
  }

  return parts.join(' | ')
}

function isTransientUploadError(error: unknown): boolean {
  const text = collectErrorText(error)
  return TRANSIENT_UPLOAD_ERROR_PATTERNS.some((pattern) => pattern.test(text))
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function withTransientUploadRetry<T>(operation: () => Promise<T>, description: string): Promise<T> {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!isTransientUploadError(error) || attempt === maxAttempts) {
        throw error
      }

      await sleep(75 * attempt)
    }
  }

  throw new Error(`Transient retry exhausted for ${description}`)
}

async function clearTrashedUploadFilenames(options: {
  payload: Payload
  collection: CollectionSlug
  req: Partial<PayloadRequest>
}): Promise<number> {
  const { payload, collection, req } = options
  const limit = 100
  let cleared = 0
  let lastBatchKey: string | null = null

  while (true) {
    const result = await payload.find({
      collection,
      where: {
        and: [{ deletedAt: { exists: true } }, { filename: { exists: true } }],
      },
      limit,
      trash: true,
      overrideAccess: true,
      req: cloneOperationReq(req),
    })

    if (result.docs.length === 0) {
      return cleared
    }

    const batchKey = result.docs.map((doc) => String(doc.id)).join(',')
    if (batchKey === lastBatchKey) {
      return cleared
    }
    lastBatchKey = batchKey

    for (const doc of result.docs as Array<{ id: string | number }>) {
      const recoveryContext = {
        ...((req.context as Record<string, unknown> | undefined) ?? {}),
        // This metadata-only repair must not ask the cloud adapter to upload a file.
        skipCloudStorage: true,
      }
      await payload.update({
        collection,
        id: doc.id,
        overrideAccess: true,
        trash: true,
        context: recoveryContext,
        data: {
          filename: null,
        },
        // Payload hooks can extend request context. Keep this one-off cloud
        // suppression out of the following upload operation.
        req: buildOperationReq(req, recoveryContext),
      })
      cleared += 1
    }
  }
}

function extractRelationKey(value: unknown): string | null {
  let relationTo = ''
  let id: unknown = value

  if (value && typeof value === 'object') {
    const relation = value as Record<string, unknown>
    relationTo = typeof relation.relationTo === 'string' ? relation.relationTo.trim() : ''
    id = Object.prototype.hasOwnProperty.call(relation, 'value') ? relation.value : relation.id

    if (id && typeof id === 'object') {
      const populatedRelation = id as Record<string, unknown>
      id = populatedRelation.id ?? populatedRelation.value
    }
  }

  if (typeof id !== 'string' && typeof id !== 'number') return null

  const normalizedId = String(id).trim()
  if (!normalizedId) return null

  return relationTo ? `${relationTo}:${normalizedId}` : normalizedId
}

function hasConfiguredRelationDrift(options: {
  current: Record<string, unknown>
  nextData: Record<string, unknown>
  relationFields: string[]
}): boolean {
  return options.relationFields.some((field) => {
    const currentKey = extractRelationKey(options.current[field])
    const nextKey = extractRelationKey(options.nextData[field])
    return currentKey !== null && nextKey !== null && currentKey !== nextKey
  })
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
    includeTrashed?: boolean
  },
) {
  const maxRetries = 3

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      await withTransientUploadRetry(
        () =>
          payload.update({
            collection: params.collection,
            id: params.id,
            data: params.data,
            ...(params.includeTrashed ? { trash: true } : {}),
            overrideAccess: true,
            context: params.context,
            req: cloneOperationReq(params.req),
            ...(params.filePath ? { filePath: params.filePath } : {}),
          }),
        `update ${params.collection}:${params.id}`,
      )
      return
    } catch (error) {
      const missingKey = params.filePath ? resolveMissingS3Key(error) : null
      if (!missingKey || !params.filePath || attempt === maxRetries) {
        throw error
      }

      payload.logger.warn(`Seed media replacement fallback for missing object key: ${missingKey}`)
      await replaceSeedUploadDocument(payload, {
        ...params,
        filePath: params.filePath,
      })
      return
    }
  }
}

async function replaceSeedUploadDocument(
  payload: Payload,
  params: {
    collection: CollectionSlug
    id: string | number
    data: Record<string, unknown>
    context: Record<string, unknown>
    req: Partial<PayloadRequest>
    filePath: string
  },
) {
  // Delete through Payload so its lifecycle hooks remove the previous S3 object
  // before the replacement claims the same stable ID and filename.
  await payload.delete({
    collection: params.collection,
    id: params.id,
    overrideAccess: true,
    trash: true,
    context: params.context,
    req: cloneOperationReq(params.req),
  })

  await withTransientUploadRetry(
    () =>
      payload.create({
        collection: params.collection,
        data: params.data,
        overrideAccess: true,
        context: params.context,
        req: cloneOperationReq(params.req),
        filePath: params.filePath,
      }),
    `replace ${params.collection}:${params.id}`,
  )
}

export async function upsertByStableId<T extends Record<string, unknown>>(
  payload: Payload,
  collection: CollectionSlug,
  data: T,
  options?: {
    filePath?: string
    context?: Record<string, unknown>
    req?: Partial<PayloadRequest>
    policy?: SeedUpsertPolicy
  },
): Promise<UpsertResult> {
  if (!hasStableId(data)) {
    throw new Error(`Missing stableId for ${collection} upsert`)
  }

  const stableId = data.stableId
  let existing = await payload.find({
    collection,
    ...(options?.policy?.skipIfCurrentMatches ? { depth: 0 } : {}),
    where: { stableId: { equals: stableId } },
    limit: 1,
    // If the document was soft-deleted (Trash), it may still exist and still
    // hold a unique stableId. Include trashed docs so we update/restore instead
    // of trying to create a duplicate that would violate unique constraints.
    trash: true,
    overrideAccess: true,
  })

  const reconciliationFields = options?.policy?.reconcileByUniqueFields ?? []
  let reconciledByUniqueFields = false

  if (existing.totalDocs === 0 && reconciliationFields.length > 0) {
    const clauses = reconciliationFields.map((field): Where => {
      const value = data[field]
      if (value === null || typeof value === 'undefined' || value === '') {
        throw new Error(`Missing ${field} for ${collection} seed reconciliation`)
      }

      return { [field]: { equals: value } }
    })

    existing = await payload.find({
      collection,
      depth: 0,
      where: clauses.length === 1 ? clauses[0] : { and: clauses },
      limit: 2,
      trash: true,
      overrideAccess: true,
    })

    if (existing.totalDocs > 1) {
      throw new Error(`Multiple ${collection} documents match the configured seed reconciliation fields`)
    }

    reconciledByUniqueFields = existing.totalDocs === 1
  }

  const operationContext = {
    disableRevalidate: true,
    disableSearchSync: true,
    ...(options?.context ?? {}),
    seedMediaExpectedNoSuchKeyRecovery: Boolean(options?.filePath),
  }
  const operationReq = buildOperationReq(options?.req, operationContext)

  if (existing.totalDocs === 0) {
    try {
      await withTransientUploadRetry(
        () =>
          payload.create({
            collection,
            data,
            overrideAccess: true,
            context: operationContext,
            req: cloneOperationReq(operationReq),
            ...(options?.filePath ? { filePath: options.filePath } : {}),
          }),
        `create ${collection}:${stableId}`,
      )
    } catch (error) {
      if (!options?.filePath || !isFilenameValidationError(error)) {
        throw error
      }

      const cleared = await clearTrashedUploadFilenames({
        payload,
        collection,
        req: operationReq,
      })

      if (cleared === 0) {
        throw error
      }

      payload.logger.warn(
        `Seed upload filename conflict recovery: cleared filename on ${cleared} trashed ${collection} doc(s) before retry`,
      )

      await withTransientUploadRetry(
        () =>
          payload.create({
            collection,
            data,
            overrideAccess: true,
            context: operationContext,
            req: cloneOperationReq(operationReq),
            ...(options?.filePath ? { filePath: options.filePath } : {}),
          }),
        `retry create ${collection}:${stableId}`,
      )
    }
    return {
      created: true,
      updated: false,
      ...(collection === 'posts' && typeof data.slug === 'string' ? { nextSlug: data.slug } : {}),
    }
  }

  const current = existing.docs[0] as {
    id: string | number
    deletedAt?: unknown
    slug?: unknown
    stableId?: unknown
  }
  const nextData: Record<string, unknown> = { ...data }

  if (reconciledByUniqueFields) {
    if (typeof current.stableId !== 'string' || current.stableId.length === 0) {
      throw new Error(`Cannot reconcile ${collection} document without its existing stableId`)
    }

    nextData.stableId = current.stableId
  }

  // If found doc is trashed, restore it by clearing deletedAt.
  if (current.deletedAt) {
    nextData.deletedAt = null
  }

  if (
    !current.deletedAt &&
    (options?.policy?.skipIfCurrentMatches
      ? valuesMatch(nextData, current)
      : options?.policy?.skipIfVersionMatches && (await hasMatchingVersion(payload, collection, current.id, nextData)))
  ) {
    return {
      created: false,
      updated: false,
    }
  }

  const filePath = options?.filePath
  const recreateOnRelationDrift = options?.policy?.recreateUploadOnRelationDrift ?? []
  if (
    recreateOnRelationDrift.length > 0 &&
    hasConfiguredRelationDrift({
      current: current as Record<string, unknown>,
      nextData,
      relationFields: recreateOnRelationDrift,
    })
  ) {
    if (!filePath) {
      throw new Error(`Seed upload replacement for relation drift requires a file: ${collection}:${stableId}`)
    }

    payload.logger.warn(`Seed upload replacement for immutable relation drift: ${collection}:${stableId}`)
    await replaceSeedUploadDocument(payload, {
      collection,
      id: current.id,
      data: nextData,
      context: operationContext,
      req: operationReq,
      filePath,
    })
    return {
      created: false,
      updated: true,
    }
  }

  await updateWithNoSuchKeyRecovery(payload, {
    collection,
    id: current.id,
    data: nextData,
    context: operationContext,
    req: operationReq,
    filePath: options?.filePath,
    includeTrashed: Boolean(current.deletedAt),
  })
  return {
    created: false,
    updated: true,
    ...(collection === 'posts' && typeof current.slug === 'string' ? { previousSlug: current.slug } : {}),
    ...(collection === 'posts' && typeof data.slug === 'string' ? { nextSlug: data.slug } : {}),
  }
}
