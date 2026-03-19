import {
  extractRelationId,
  getIncomingUploadFilename,
  resolveFilenameSource,
} from '@/collections/common/mediaPathHelpers'
import { extractFileSizeFromRequest } from '@/utilities/requestFileUtils'
import { createScopedLogger, getRequestLogContext, type ServerLogger } from '@/utilities/logging/shared'
import type { CollectionAfterErrorHook, CollectionBeforeOperationHook, PayloadRequest } from 'payload'

const MEDIA_UPLOAD_CONTEXT_KEY = 'mediaUploadLog'

type MediaUploadContext = {
  collection: string
  event: 'storage.media.upload_attempt'
  fileName?: string
  fileSize?: number
  operation: 'create' | 'update'
  ownerId?: string
  ownerField?: string
  storagePrefix: string
}

const SEED_MEDIA_EXPECTED_NO_SUCH_KEY_RECOVERY = 'seedMediaExpectedNoSuchKeyRecovery'

const readFileName = (args: Record<string, unknown> | undefined, req: PayloadRequest): string | undefined => {
  const argsFilename = resolveFilenameSource({
    req: args ?? null,
    draftFilename: (args?.data as Record<string, unknown> | undefined)?.filename,
  })

  if (argsFilename) return argsFilename

  const requestFilename = resolveFilenameSource({
    req: req as unknown as Record<string, unknown>,
  })

  return requestFilename ?? undefined
}

const readFileSize = (args: Record<string, unknown> | undefined, req: PayloadRequest): number | undefined => {
  const argsFileSize = extractFileSizeFromRequest(args)
  if (typeof argsFileSize === 'number') return argsFileSize

  return extractFileSizeFromRequest(req)
}

const readOwnerId = (ownerField: string | undefined, data: Record<string, unknown> | undefined): string | undefined => {
  if (!ownerField || !data) return undefined
  const relationId = extractRelationId(
    data[ownerField] as string | number | { id?: string | number; value?: string | number },
  )
  return relationId ?? undefined
}

const getMediaUploadLogger = (req: PayloadRequest): ReturnType<typeof createScopedLogger> => {
  return createScopedLogger(req.payload.logger as ServerLogger, {
    scope: 'storage.media',
    ...getRequestLogContext({ req, headers: req.headers }),
  })
}

const hasIncomingUpload = (args: Record<string, unknown> | undefined, req: PayloadRequest): boolean => {
  const argsUploadFilename = getIncomingUploadFilename(args ?? null)
  if (argsUploadFilename) return true

  const requestUploadFilename = getIncomingUploadFilename(req as unknown as Record<string, unknown>)
  if (requestUploadFilename) return true

  const fileSize = readFileSize(args, req)
  return typeof fileSize === 'number'
}

type MissingKeyErrorLike = {
  name?: unknown
  Code?: unknown
  message?: unknown
  Resource?: unknown
  cause?: unknown
  err?: unknown
}

function parseMissingResourceFromMessage(message: string): string | null {
  const match = /Resource":"([^"]+)"/.exec(message)
  return match?.[1] ?? null
}

function resolveMissingS3Key(error: unknown): string | null {
  const bucket = process.env.S3_BUCKET || ''
  if (!bucket) return null

  const candidates: MissingKeyErrorLike[] = []
  if (error && typeof error === 'object') {
    candidates.push(error as MissingKeyErrorLike)

    const cause = (error as { cause?: unknown }).cause
    if (cause && typeof cause === 'object') {
      candidates.push(cause as MissingKeyErrorLike)
    }

    const nestedErr = (error as { err?: unknown }).err
    if (nestedErr && typeof nestedErr === 'object') {
      candidates.push(nestedErr as MissingKeyErrorLike)
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

function shouldDowngradeMissingKeyError(req: PayloadRequest, error: unknown): boolean {
  const requestContext = req.context as Record<string, unknown> | undefined
  return requestContext?.[SEED_MEDIA_EXPECTED_NO_SUCH_KEY_RECOVERY] === true && resolveMissingS3Key(error) !== null
}

export const beforeOperationCaptureMediaUpload =
  ({ ownerField, storagePrefix }: { ownerField?: string; storagePrefix: string }): CollectionBeforeOperationHook =>
  ({ args, collection, operation, req }) => {
    if (operation !== 'create' && operation !== 'update') return

    const recordArgs = args as Record<string, unknown> | undefined
    req.context = req.context ?? {}

    if (!hasIncomingUpload(recordArgs, req)) {
      delete req.context[MEDIA_UPLOAD_CONTEXT_KEY]
      return
    }

    const fileName = readFileName(recordArgs, req)
    const fileSize = readFileSize(recordArgs, req)
    const data = (recordArgs?.data as Record<string, unknown> | undefined) ?? undefined
    const ownerId = readOwnerId(ownerField, data)

    req.context[MEDIA_UPLOAD_CONTEXT_KEY] = {
      collection: collection.slug,
      event: 'storage.media.upload_attempt',
      ...(fileName ? { fileName } : {}),
      ...(typeof fileSize === 'number' ? { fileSize } : {}),
      operation,
      ...(ownerId ? { ownerId } : {}),
      ...(ownerField ? { ownerField } : {}),
      storagePrefix,
    } satisfies MediaUploadContext
  }

export const afterErrorLogMediaUploadError: CollectionAfterErrorHook = ({ collection, error, req }) => {
  const uploadContext = req.context?.[MEDIA_UPLOAD_CONTEXT_KEY] as MediaUploadContext | undefined

  if (!uploadContext) return

  const logger = getMediaUploadLogger(req)

  if (shouldDowngradeMissingKeyError(req, error)) {
    logger.warn(
      {
        event: 'storage.media.upload_recovery_needed',
        collection: collection.slug,
        fileName: uploadContext.fileName,
        fileSize: uploadContext.fileSize,
        missingKey: resolveMissingS3Key(error),
        operation: uploadContext.operation,
        ownerField: uploadContext.ownerField,
        ownerId: uploadContext.ownerId,
        storagePrefix: uploadContext.storagePrefix,
      },
      'Media upload missing object key; seed recovery can replace the upload',
    )
    delete req.context?.[MEDIA_UPLOAD_CONTEXT_KEY]
    return
  }

  logger.error(
    {
      event: 'storage.media.upload_failed',
      collection: collection.slug,
      fileName: uploadContext.fileName,
      fileSize: uploadContext.fileSize,
      operation: uploadContext.operation,
      ownerField: uploadContext.ownerField,
      ownerId: uploadContext.ownerId,
      storagePrefix: uploadContext.storagePrefix,
      err: error,
    },
    'Media upload failed',
  )

  delete req.context?.[MEDIA_UPLOAD_CONTEXT_KEY]
}
