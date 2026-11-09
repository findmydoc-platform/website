import { APIError, type PayloadRequest } from 'payload'
import { relationId } from '@/collections/clinics/profileGallery'
import { clinicGallerySaveInputSchema } from './contracts'
import { readClinicGallerySnapshot, saveClinicGallery } from './service'
import { richTextToPlainText } from '@/features/clinicDashboard/profile/richText'
import { clinicProfileMediaImageMimeTypes } from '@/collections/common/mediaCollection'
import { MEDIA_UPLOAD_MAX_BYTES } from '@/config/mediaUploadPolicy'
import type { ClinicGallerySaveInput } from './contracts'

export async function requireCurrentPlatformStaff(req: PayloadRequest): Promise<void> {
  if (req.user?.collection !== 'platformStaff') throw new APIError('Platform staff access is required.', 403)
  const staff = await req.payload
    .findByID({
      collection: 'platformStaff',
      id: req.user.id,
      depth: 0,
      overrideAccess: true,
      req,
      select: { role: true },
    })
    .catch(() => null)
  if (!staff || !['admin', 'support', 'content-manager'].includes(staff.role)) {
    throw new APIError('Platform staff access is required.', 403)
  }
}

async function requirePlatformClinicAccess(req: PayloadRequest, clinicId: number): Promise<void> {
  await requireCurrentPlatformStaff(req)
  await req.payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: false, req })
}

export async function readPlatformClinicGallery(req: PayloadRequest, clinicId: number) {
  await requirePlatformClinicAccess(req, clinicId)
  return (await readClinicGallerySnapshot(req, clinicId)).snapshot
}

export async function readPlatformClinicGalleryImage(req: PayloadRequest, clinicId: number, mediaId: number) {
  const snapshot = await readPlatformClinicGallery(req, clinicId)
  if (!snapshot.items.some((item) => item.id === String(mediaId))) throw new APIError('Gallery image not found.', 404)
  const media = await req.payload.findByID({
    collection: 'clinicMedia',
    id: mediaId,
    depth: 0,
    overrideAccess: false,
    req,
  })
  if (!media.filename || !media.mimeType || !clinicProfileMediaImageMimeTypes.includes(media.mimeType)) {
    throw new APIError('Gallery image is unavailable.', 503)
  }
  const upload = req.payload.collections.clinicMedia.config.upload
  if (!upload || !upload.handlers?.length) throw new APIError('Gallery image is unavailable.', 503)
  for (const handler of upload.handlers) {
    const response = await handler(req, {
      doc: media,
      headers: new Headers(),
      params: { collection: 'clinicMedia', filename: media.filename, prefix: media.prefix ?? undefined },
    })
    if (!(response instanceof Response)) continue
    if (response.status !== 200 || !response.body) throw new APIError('Gallery image is unavailable.', 503)
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > MEDIA_UPLOAD_MAX_BYTES) {
        await reader.cancel()
        throw new APIError('Gallery image exceeds the download limit.', 413)
      }
      chunks.push(result.value)
    }
    return { data: Buffer.concat(chunks).toString('base64'), mimeType: media.mimeType }
  }
  throw new APIError('Gallery image is unavailable.', 503)
}

export async function savePlatformClinicGallery(req: PayloadRequest, clinicId: number, input: ClinicGallerySaveInput) {
  await requirePlatformClinicAccess(req, clinicId)
  return (await saveClinicGallery(req, clinicId, clinicGallerySaveInputSchema.parse(input))).snapshot
}

/** Add one existing clinic image through the same revision-protected gallery command as the dashboard. */
export async function appendPlatformClinicGalleryMedia(req: PayloadRequest, mediaId: number) {
  await requireCurrentPlatformStaff(req)
  const media = await req.payload.findByID({
    collection: 'clinicMedia',
    id: mediaId,
    depth: 0,
    overrideAccess: false,
    req,
  })
  const clinicId = relationId(media.clinic)
  if (clinicId === null) throw new APIError('The clinic image has no owner.', 422)
  await req.payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: false, req })
  const { snapshot } = await readClinicGallerySnapshot(req, clinicId)
  if (snapshot.items.some((item) => item.id === String(mediaId))) return snapshot
  const input = clinicGallerySaveInputSchema.safeParse({
    expectedRevision: snapshot.revision,
    items: [
      ...snapshot.items.map(({ id, alt, captionText }) => ({
        mediaId: id,
        alt,
        ...(captionText ? { captionText } : {}),
      })),
      { mediaId: String(mediaId), alt: media.alt ?? '', captionText: richTextToPlainText(media.caption) },
    ],
  })
  if (!input.success) throw new APIError('An image needs alt text and the gallery must have room for it.', 422)
  return (await saveClinicGallery(req, clinicId, input.data)).snapshot
}
