import { APIError, type PayloadRequest } from 'payload'
import { relationId } from '@/collections/clinics/profileGallery'
import { classifyDatabaseAvailabilityError } from '@/features/databaseAvailability'
import { clinicGallerySaveInputSchema, getClinicGallerySaveRejection } from './contracts'
import { readClinicGallerySnapshot, saveClinicGallery } from './service'
import { richTextToPlainText } from '@/features/clinicDashboard/profile/richText'
import { readStoredImage } from '@/features/platformMedia/readStoredImage'
import type { ClinicGallerySaveInput } from './contracts'

type StaffLookupOptions = { propagateDatabaseFailure?: boolean }

export async function requireCurrentPlatformStaff(req: PayloadRequest, options?: StaffLookupOptions): Promise<void> {
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
    .catch((error: unknown) => {
      if (options?.propagateDatabaseFailure && classifyDatabaseAvailabilityError(error)) throw error
      return null
    })
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
  return readStoredImage(req, 'clinicMedia', mediaId)
}

export async function savePlatformClinicGallery(req: PayloadRequest, clinicId: number, input: ClinicGallerySaveInput) {
  await requirePlatformClinicAccess(req, clinicId)
  return (await saveClinicGallery(req, clinicId, clinicGallerySaveInputSchema.parse(input))).snapshot
}

/** Add one existing clinic image through the same revision-protected gallery command as the dashboard. */
export async function appendPlatformClinicGalleryMedia(
  req: PayloadRequest,
  mediaId: number,
  options?: StaffLookupOptions,
) {
  await requireCurrentPlatformStaff(req, options)
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
  if (!input.success) {
    const rejection = getClinicGallerySaveRejection(input.error)
    if (!rejection) throw new APIError('Review the clinic gallery and try adding the image again.', 422)
    if (rejection.kind === 'full') {
      throw new APIError(
        'The clinic gallery is full. Open the clinic in Clinics. In General → Profile Gallery, remove an image from the gallery and save the clinic.',
        422,
      )
    }

    const image = rejection.index < snapshot.items.length ? `gallery image ${rejection.index + 1}` : 'this image'
    if (rejection.kind === 'missing-alt') {
      throw new APIError(`Add alt text to ${image} and save it before trying again.`, 422)
    }
    const label = rejection.kind === 'alt-too-long' ? 'alt text' : 'caption'
    throw new APIError(`Shorten the ${label} for ${image} to ${rejection.maximum} characters or fewer.`, 422)
  }
  return (await saveClinicGallery(req, clinicId, input.data)).snapshot
}
