import { beforeOperationValidateMediaUpload } from '@/hooks/media/validateMediaUpload'
import { galleryMediaImageMimeTypes, standardMediaImageMimeTypes } from '@/collections/common/mediaCollection'
import { MEDIA_UPLOAD_MAX_BYTES, MEDIA_UPLOAD_TOO_LARGE_MESSAGE } from '@/config/mediaUploadPolicy'
import { describe, expect, it } from 'vitest'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64',
)

const runValidation = (
  file: { data?: Buffer; mimetype: string; size: number },
  acceptedMimeTypes = galleryMediaImageMimeTypes,
) => {
  return beforeOperationValidateMediaUpload({
    args: { file },
    collection: { upload: { mimeTypes: acceptedMimeTypes } },
    operation: 'create',
    req: {},
  } as never)
}

describe('beforeOperationValidateMediaUpload', () => {
  it('rejects files larger than 4 MB with HTTP 413', async () => {
    await expect(runValidation({ mimetype: 'image/png', size: MEDIA_UPLOAD_MAX_BYTES + 1 })).rejects.toThrowError(
      expect.objectContaining({ message: MEDIA_UPLOAD_TOO_LARGE_MESSAGE, status: 413 }),
    )
  })

  it('rejects unsupported gallery formats with HTTP 400 and the gallery format list', async () => {
    await expect(runValidation({ mimetype: 'image/svg+xml', size: 1024 })).rejects.toThrowError(
      expect.objectContaining({
        message: 'Unsupported image format. Accepted formats: JPG, PNG, WebP, AVIF, GIF.',
        status: 400,
      }),
    )
  })

  it('rejects files whose content is not a valid configured image', async () => {
    await expect(
      runValidation({ data: Buffer.from('not an image'), mimetype: 'image/png', size: 12 }),
    ).rejects.toThrowError(
      expect.objectContaining({
        message: 'Unsupported image format. Accepted formats: JPG, PNG, WebP, AVIF, GIF.',
        status: 400,
      }),
    )
  })

  it('accepts a valid PNG based on its content', async () => {
    await expect(
      runValidation({ data: TINY_PNG, mimetype: 'image/png', size: TINY_PNG.length }),
    ).resolves.toBeUndefined()
  })

  it('accepts SVG for media collections that configure it', async () => {
    await expect(
      runValidation({ mimetype: 'image/svg+xml', size: 1024 }, standardMediaImageMimeTypes),
    ).resolves.toBeUndefined()
  })
})
