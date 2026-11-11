import { APIError, type PayloadRequest } from 'payload'
import { clinicProfileMediaImageMimeTypes, standardMediaImageMimeTypes } from '@/collections/common/mediaCollection'
import { MEDIA_UPLOAD_MAX_BYTES } from '@/config/mediaUploadPolicy'

/** Read an image through the collection's authorized storage adapter. */
export async function readStoredImage(req: PayloadRequest, collection: 'clinicMedia' | 'doctorMedia', id: number) {
  const media = await req.payload.findByID({ collection, id, depth: 0, overrideAccess: false, req })
  const acceptedTypes = collection === 'clinicMedia' ? clinicProfileMediaImageMimeTypes : standardMediaImageMimeTypes
  if (!media.filename || !media.mimeType || !acceptedTypes.includes(media.mimeType)) {
    throw new APIError('Image is unavailable.', 503)
  }
  const upload = req.payload.collections[collection].config.upload
  if (!upload || !upload.handlers?.length) throw new APIError('Image is unavailable.', 503)
  for (const handler of upload.handlers) {
    const response = await handler(req, {
      doc: media,
      headers: new Headers(),
      params: { collection, filename: media.filename, prefix: media.prefix ?? undefined },
    })
    if (!(response instanceof Response)) continue
    if (response.status !== 200 || !response.body) throw new APIError('Image is unavailable.', 503)
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > MEDIA_UPLOAD_MAX_BYTES) {
        await reader.cancel()
        throw new APIError('Image exceeds the download limit.', 413)
      }
      chunks.push(result.value)
    }
    return { data: Buffer.concat(chunks).toString('base64'), mimeType: media.mimeType }
  }
  throw new APIError('Image is unavailable.', 503)
}
