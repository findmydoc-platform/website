import type { CollectionBeforeChangeHook } from 'payload'
import { extractRelationId } from '@/collections/common/mediaPathHelpers'

const PUBLISHED_STATUS = 'published'

type GalleryMedia = {
  id: string | number
  clinic?: any
  status?: string
}

async function validateMediaOwnership(
  payload: any,
  mediaId: string | number,
  clinicId: string,
  requirePublished: boolean,
): Promise<void> {
  if (!payload) {
    return
  }

  const media = (await payload.findByID({ collection: 'clinicGalleryMedia', id: mediaId, depth: 0 })) as GalleryMedia
  if (!media) {
    throw new Error(`Referenced gallery media ${mediaId} could not be found`)
  }

  const mediaClinic = extractRelationId(media.clinic)
  if (mediaClinic && String(mediaClinic) !== String(clinicId)) {
    throw new Error('Gallery entries can only reference media from the same clinic')
  }

  if (requirePublished && media.status !== PUBLISHED_STATUS) {
    throw new Error('Gallery entries can only be published when all referenced media are published')
  }
}

/**
 * Normalizes variant fields, enforces required media relationships,
 * and validates referenced media ownership/publication state.
 * - Ensures single/pair media are present per variant
 * - Verifies all referenced media belong to the same clinic
 * - When entry status is published, requires all referenced media to be published
 */
export const beforeChangeClinicGalleryEntry: CollectionBeforeChangeHook<any> = async ({ data, originalDoc, req }) => {
  const draft: any = { ...(data || {}) }

  const clinicId = String(extractRelationId(draft.clinic) ?? extractRelationId(originalDoc?.clinic) ?? '')
  if (!clinicId) {
    throw new Error('Clinic is required for gallery entries')
  }

  const nextVariant = draft.variant ?? originalDoc?.variant ?? 'single'
  draft.variant = nextVariant

  if (nextVariant === 'single') {
    const singleId = extractRelationId(draft.singleMedia ?? originalDoc?.singleMedia)
    if (!singleId) {
      throw new Error('Single variant gallery entries require a media reference')
    }
    draft.singleMedia = singleId
    draft.beforeMedia = undefined
    draft.afterMedia = undefined
  } else {
    const beforeId = extractRelationId(draft.beforeMedia ?? originalDoc?.beforeMedia)
    const afterId = extractRelationId(draft.afterMedia ?? originalDoc?.afterMedia)
    if (!beforeId || !afterId) {
      throw new Error('Before/after gallery entries require both before and after media')
    }
    draft.beforeMedia = beforeId
    draft.afterMedia = afterId
    draft.singleMedia = undefined
  }

  const nextStatus = draft.status ?? originalDoc?.status ?? 'draft'
  draft.status = nextStatus
  const requirePublished = nextStatus === PUBLISHED_STATUS

  const mediaIds: Array<string | number> = []
  if (draft.variant === 'single' && draft.singleMedia) {
    mediaIds.push(draft.singleMedia)
  }
  if (draft.variant === 'pair') {
    if (draft.beforeMedia) mediaIds.push(draft.beforeMedia)
    if (draft.afterMedia) mediaIds.push(draft.afterMedia)
  }

  for (const id of mediaIds) {
    await validateMediaOwnership(req.payload, id, clinicId, requirePublished)
  }

  // publishedAt transition handled by a shared hook registered at the collection level

  return draft
}
