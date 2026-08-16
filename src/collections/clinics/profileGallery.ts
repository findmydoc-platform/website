import type { Clinic } from '@/payload-types'
import type { CollectionBeforeChangeHook } from 'payload'
import { ValidationError } from 'payload'

const PROFILE_GALLERY_MAX_ITEMS = 12
const PROFILE_GALLERY_INVALID_MESSAGE = 'Select up to 12 published images that belong to this clinic.'

type RelationId = number | string

export const relationId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}

const failProfileGallery = (req: Parameters<CollectionBeforeChangeHook<Clinic>>[0]['req'], id?: RelationId) => {
  throw new ValidationError({
    collection: 'clinics',
    errors: [
      {
        label: 'Profile gallery',
        message: PROFILE_GALLERY_INVALID_MESSAGE,
        path: 'profileGallery',
      },
    ],
    id,
    req,
  })
}

export const beforeChangeSynchronizeClinicProfileGallery: CollectionBeforeChangeHook<Clinic> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const hasIncomingGallery = Object.prototype.hasOwnProperty.call(data, 'profileGallery')
  if (operation === 'update' && !hasIncomingGallery) {
    data.thumbnail = originalDoc?.thumbnail ?? null
    return data
  }

  const incoming = hasIncomingGallery ? data.profileGallery : originalDoc?.profileGallery
  const values = Array.isArray(incoming) ? incoming : []
  const ids = values.map(relationId)
  const uniqueIds = new Set(ids.map(String))
  const clinicId = relationId(originalDoc?.id ?? data.id)

  if (
    ids.length > PROFILE_GALLERY_MAX_ITEMS ||
    ids.some((id) => id === null) ||
    uniqueIds.size !== ids.length ||
    (ids.length > 0 && clinicId === null)
  ) {
    failProfileGallery(req, clinicId ?? undefined)
  }

  if (ids.length > 0 && clinicId !== null) {
    const media = await req.payload.find({
      collection: 'clinicMedia',
      depth: 0,
      limit: ids.length,
      overrideAccess: true,
      pagination: false,
      req,
      select: {
        clinic: true,
        id: true,
        status: true,
      },
      where: {
        id: {
          in: ids as RelationId[],
        },
      },
    })

    const validIds = new Set(
      media.docs
        .filter((item) => String(relationId(item.clinic)) === String(clinicId) && item.status === 'published')
        .map((item) => String(item.id)),
    )

    if (ids.some((id) => !validIds.has(String(id)))) {
      failProfileGallery(req, clinicId)
    }
  }

  data.profileGallery = ids as Clinic['profileGallery']
  data.thumbnail = (ids[0] ?? null) as Clinic['thumbnail']
  return data
}

export const clinicProfileGalleryMaxItems = PROFILE_GALLERY_MAX_ITEMS
