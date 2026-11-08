import { APIError, type PayloadRequest } from 'payload'
import { relationId } from '@/collections/clinics/profileGallery'
import { clinicGallerySaveInputSchema } from './contracts'
import { readClinicGallerySnapshot, saveClinicGallery } from './service'
import { richTextToPlainText } from '@/features/clinicDashboard/profile/richText'
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
