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
