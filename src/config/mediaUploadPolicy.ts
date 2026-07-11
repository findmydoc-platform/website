export const MEDIA_UPLOAD_MAX_BYTES = 4 * 1024 * 1024
export const MEDIA_UPLOAD_MAX_SIZE_LABEL = '4 MB'

export const MEDIA_UPLOAD_TOO_LARGE_MESSAGE = `Image is too large. Maximum file size is ${MEDIA_UPLOAD_MAX_SIZE_LABEL}.`
export const MEDIA_STORAGE_LIMIT_MESSAGE =
  'Image processing exceeded the storage limit. Please reduce the image dimensions or file size and try again.'

const MEDIA_FORMAT_LABELS: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
}

export function getAcceptedMediaFormatLabels(mimeTypes: readonly string[]): string[] {
  return mimeTypes.map((mimeType) => MEDIA_FORMAT_LABELS[mimeType] ?? mimeType)
}

export function getAcceptedMediaFormats(mimeTypes: readonly string[]): string {
  return getAcceptedMediaFormatLabels(mimeTypes).join(', ')
}

export function getMediaUploadHint(mimeTypes: readonly string[]): string {
  return `Accepted formats: ${getAcceptedMediaFormats(mimeTypes)}. Maximum file size: ${MEDIA_UPLOAD_MAX_SIZE_LABEL}.`
}

export function getUnsupportedMediaFormatMessage(mimeTypes: readonly string[]): string {
  return `Unsupported image format. Accepted formats: ${getAcceptedMediaFormats(mimeTypes)}.`
}

export function isAcceptedMediaMimeType(mimeType: string, acceptedMimeTypes: readonly string[]): boolean {
  return acceptedMimeTypes.some((acceptedMimeType) => {
    if (acceptedMimeType.endsWith('/*')) {
      return mimeType.startsWith(acceptedMimeType.slice(0, -1))
    }

    return mimeType === acceptedMimeType
  })
}

export function getMediaUploadValidationError(options: {
  acceptedMimeTypes: readonly string[]
  mimeType?: string
  size?: number
}): string | null {
  if (typeof options.size === 'number' && options.size > MEDIA_UPLOAD_MAX_BYTES) {
    return MEDIA_UPLOAD_TOO_LARGE_MESSAGE
  }

  if (!options.mimeType || !isAcceptedMediaMimeType(options.mimeType, options.acceptedMimeTypes)) {
    return getUnsupportedMediaFormatMessage(options.acceptedMimeTypes)
  }

  return null
}
