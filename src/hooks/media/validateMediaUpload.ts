import {
  getMediaUploadValidationError,
  getUnsupportedMediaFormatMessage,
  MEDIA_UPLOAD_TOO_LARGE_MESSAGE,
} from '@/config/mediaUploadPolicy'
import {
  extractFileFromRequest,
  extractFileMimeTypeFromRequest,
  extractFileSizeFromRequest,
  type RequestFile,
} from '@/utilities/requestFileUtils'
import { APIError, type CollectionBeforeOperationHook } from 'payload'
import sharp from 'sharp'

const SHARP_FORMAT_MIME_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

const detectIncomingFileMimeType = async (file: RequestFile): Promise<string | null | undefined> => {
  const data = file.data
  if (data instanceof Uint8Array && data.length > 0) {
    const metadata = await sharp(data).metadata()
    return metadata.format ? (SHARP_FORMAT_MIME_TYPES[metadata.format] ?? null) : null
  }

  const tempFilePath = file.tempFilePath
  if (typeof tempFilePath === 'string' && tempFilePath.length > 0) {
    const metadata = await sharp(tempFilePath).metadata()
    return metadata.format ? (SHARP_FORMAT_MIME_TYPES[metadata.format] ?? null) : null
  }

  return undefined
}

export const beforeOperationValidateMediaUpload: CollectionBeforeOperationHook = async ({
  args,
  collection,
  operation,
  req,
}) => {
  if (operation !== 'create' && operation !== 'update') return

  const acceptedMimeTypes = collection.upload.mimeTypes ?? []
  const mimeType = extractFileMimeTypeFromRequest(args) ?? extractFileMimeTypeFromRequest(req)
  const size = extractFileSizeFromRequest(args) ?? extractFileSizeFromRequest(req)
  const file = extractFileFromRequest(args) ?? extractFileFromRequest(req)

  if (!mimeType && typeof size !== 'number') return

  const initialMessage = getMediaUploadValidationError({ acceptedMimeTypes, mimeType, size })
  if (initialMessage) {
    throw new APIError(initialMessage, initialMessage === MEDIA_UPLOAD_TOO_LARGE_MESSAGE ? 413 : 400)
  }

  let effectiveMimeType = mimeType

  if (file) {
    try {
      const detectedMimeType = await detectIncomingFileMimeType(file)
      if (detectedMimeType) {
        effectiveMimeType = detectedMimeType
      } else if (detectedMimeType === null && mimeType !== 'image/svg+xml') {
        effectiveMimeType = undefined
      }
    } catch {
      throw new APIError(getUnsupportedMediaFormatMessage(acceptedMimeTypes), 400)
    }
  }

  const message = getMediaUploadValidationError({ acceptedMimeTypes, mimeType: effectiveMimeType, size })
  if (!message) return

  throw new APIError(message, message === MEDIA_UPLOAD_TOO_LARGE_MESSAGE ? 413 : 400)
}
