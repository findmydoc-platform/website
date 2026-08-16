import fs from 'fs/promises'
import { APIError, type CollectionBeforeOperationHook } from 'payload'
import sharp from 'sharp'

import { extractFileFromRequest, type RequestFile } from '@/utilities/requestFileUtils'

export const CLINIC_MEDIA_MAX_PIXELS = 50_000_000
export const CLINIC_MEDIA_TOO_MANY_PIXELS_MESSAGE =
  'Image dimensions are too large. Maximum image size is 50 megapixels.'

type SupportedFormat = 'avif' | 'jpeg' | 'png' | 'webp'

export const isClinicMediaWithinPixelLimit = (width: number, height: number): boolean =>
  width > 0 && height > 0 && width * height <= CLINIC_MEDIA_MAX_PIXELS

const readBuffer = async (file: RequestFile): Promise<Buffer | null> => {
  if (Buffer.isBuffer(file.data)) return file.data
  if (file.data instanceof Uint8Array) return Buffer.from(file.data)
  if (typeof file.tempFilePath === 'string' && file.tempFilePath.trim()) {
    return fs.readFile(file.tempFilePath)
  }
  return null
}

const normalize = async (buffer: Buffer): Promise<{ buffer: Buffer; format: SupportedFormat; mimeType: string }> => {
  const image = sharp(buffer, { failOn: 'error' })
  const metadata = await image.metadata()
  const format = metadata.format === 'heif' && metadata.compression === 'av1' ? 'avif' : metadata.format
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0

  if (!format || !['avif', 'jpeg', 'png', 'webp'].includes(format)) {
    throw new APIError('Unsupported image format. Accepted formats: JPG, PNG, WebP, AVIF.', 400)
  }
  if (!isClinicMediaWithinPixelLimit(width, height)) {
    throw new APIError(CLINIC_MEDIA_TOO_MANY_PIXELS_MESSAGE, 400)
  }

  const supportedFormat = format as SupportedFormat
  const rotated = image.rotate()
  let normalized: Buffer

  switch (supportedFormat) {
    case 'jpeg':
      normalized = await rotated.jpeg({ mozjpeg: true, quality: 90 }).toBuffer()
      break
    case 'png':
      normalized = await rotated.png({ compressionLevel: 9 }).toBuffer()
      break
    case 'webp':
      normalized = await rotated.webp({ quality: 90 }).toBuffer()
      break
    case 'avif':
      normalized = await rotated.avif({ quality: 65 }).toBuffer()
      break
  }

  return {
    buffer: normalized,
    format: supportedFormat,
    mimeType: `image/${supportedFormat}`,
  }
}

const writeNormalizedFile = async (file: RequestFile, result: Awaited<ReturnType<typeof normalize>>): Promise<void> => {
  file.data = result.buffer
  file.size = result.buffer.byteLength
  file.mimetype = result.mimeType
  file.mimeType = result.mimeType
  file.type = result.mimeType

  if (typeof file.tempFilePath === 'string' && file.tempFilePath.trim()) {
    await fs.writeFile(file.tempFilePath, result.buffer)
  }
}

export const beforeOperationNormalizeClinicMediaUpload: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if (operation !== 'create' && operation !== 'update') return args

  const files = [extractFileFromRequest(args), extractFileFromRequest(req)].filter(
    (file, index, all): file is RequestFile => Boolean(file) && all.indexOf(file) === index,
  )
  if (files.length === 0) return args

  const firstFile = files[0]
  if (!firstFile) return args
  const source = await readBuffer(firstFile)
  if (!source) throw new APIError('The uploaded image could not be read.', 400)

  let result: Awaited<ReturnType<typeof normalize>>
  try {
    result = await normalize(source)
  } catch (error: unknown) {
    if (error instanceof APIError) throw error
    throw new APIError('The uploaded image could not be processed.', 400)
  }

  await Promise.all(files.map((file) => writeNormalizedFile(file, result)))
  return args
}
