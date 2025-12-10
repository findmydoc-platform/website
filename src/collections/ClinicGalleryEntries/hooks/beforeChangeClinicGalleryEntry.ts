import type { CollectionBeforeChangeHook, Payload } from 'payload'
import { extractRelationId } from '@/collections/common/mediaPathHelpers'
import type { ClinicGalleryEntry, ClinicGalleryMedia } from '@/payload-types'

const PUBLISHED_STATUS = 'published'

async function validateMediaOwnership(
  payload: Payload,
  mediaId: string | number,
  clinicId: number,
  requirePublished: boolean,
): Promise<void> {
  if (!payload) {
    return
  }

  const media = (await payload.findByID({
    collection: 'clinicGalleryMedia',
    id: mediaId,
    depth: 0,
  })) as ClinicGalleryMedia
  if (!media) {
    throw new Error(`Referenced gallery media ${mediaId} could not be found`)
  }

  const mediaClinic = extractRelationId(media.clinic)
  if (mediaClinic && Number(mediaClinic) !== Number(clinicId)) {
    throw new Error('Gallery entries can only reference media from the same clinic')
  }

  if (requirePublished && media.status !== PUBLISHED_STATUS) {
    throw new Error('Gallery entries can only be published when all referenced media are published')
  }
}

/**
 * Enforces required media relationships and validates referenced media ownership/publication state.
 * - Before and after media must both be present
 * - Verifies referenced media belong to the same clinic
 * - When entry status is published, requires both media to be published
 */
export const beforeChangeClinicGalleryEntry: CollectionBeforeChangeHook<ClinicGalleryEntry> = async ({
  data,
  originalDoc,
  req,
}) => {
  const draft = { ...(data || {}) } as Partial<ClinicGalleryEntry>

  const clinicIdRaw = extractRelationId(draft.clinic) ?? extractRelationId(originalDoc?.clinic)
  const clinicId = clinicIdRaw ? Number(clinicIdRaw) : NaN
  if (!Number.isFinite(clinicId)) {
    throw new Error('Clinic is required for gallery entries')
  }

  const beforeIdRaw = extractRelationId(draft.beforeMedia ?? originalDoc?.beforeMedia)
  const afterIdRaw = extractRelationId(draft.afterMedia ?? originalDoc?.afterMedia)
  const beforeId = beforeIdRaw ? Number(beforeIdRaw) : NaN
  const afterId = afterIdRaw ? Number(afterIdRaw) : NaN
  if (!Number.isFinite(beforeId) || !Number.isFinite(afterId)) {
    throw new Error('Before and after media are required for gallery entries')
  }
  draft.beforeMedia = beforeId
  draft.afterMedia = afterId

  const nextStatus = draft.status ?? originalDoc?.status ?? 'draft'
  draft.status = nextStatus
  const requirePublished = nextStatus === PUBLISHED_STATUS

  const mediaIds: Array<number> = [draft.beforeMedia, draft.afterMedia]

  for (const id of mediaIds) {
    await validateMediaOwnership(req.payload, id, clinicId, requirePublished)
  }

  // publishedAt transition handled by a shared hook registered at the collection level

  return draft
}
