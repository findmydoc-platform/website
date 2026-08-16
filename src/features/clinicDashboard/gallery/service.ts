import type { Payload, PayloadRequest } from 'payload'

import type { Clinic, ClinicMedia } from '@/payload-types'
import { relationId } from '@/collections/clinics/profileGallery'
import { preserveOrCanonicalizeDescription, richTextToPlainText } from '@/features/clinicDashboard/profile/richText'
import { dispatchClinicGalleryChangeRevalidation } from '@/hooks/revalidateClinicSurfaces'
import { getServerSideURL } from '@/utilities/getURL'
import { resolveMediaDescriptorFromLoadedRelation } from '@/utilities/media/relationMedia'
import { versionPayloadMediaFileUrl } from '@/utilities/media/fileUrls'
import type { RequestFile } from '@/utilities/requestFileUtils'
import {
  clinicGalleryConstraints,
  type ClinicGalleryDiscardInput,
  type ClinicGalleryMediaDTO,
  type ClinicGallerySaveInput,
  type ClinicGallerySnapshotDTO,
  type ClinicGalleryUploadInput,
} from './contracts'

export type ClinicGalleryServiceErrorKind = 'conflict' | 'invalid-input' | 'not-found' | 'unavailable'

export class ClinicGalleryServiceError extends Error {
  constructor(
    readonly kind: ClinicGalleryServiceErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'ClinicGalleryServiceError'
  }
}

type RelationId = number | string

type GalleryContext = {
  clinic: Clinic
  galleryIds: RelationId[]
}

export type ClinicGalleryReadResult = {
  cleanupCandidateIds: string[]
  snapshot: ClinicGallerySnapshotDTO
}

export type ClinicGallerySaveResult = ClinicGalleryReadResult & {
  removedMediaIds: string[]
}

export const CLINIC_GALLERY_ABANDONED_DRAFT_MIN_AGE_MS = 24 * 60 * 60 * 1_000

const payloadId = (value: string): RelationId => {
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : value
}

const uniqueRelationIds = (values: unknown): RelationId[] => {
  if (!Array.isArray(values)) return []
  const ids = values.map(relationId).filter((id): id is RelationId => id !== null)
  return [...new Map(ids.map((id) => [String(id), id])).values()]
}

const readGalleryContext = async (req: PayloadRequest, clinicId: RelationId): Promise<GalleryContext> => {
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    depth: 0,
    id: clinicId,
    overrideAccess: true,
    req,
  })

  return {
    clinic,
    galleryIds: uniqueRelationIds(clinic.profileGallery),
  }
}

const mediaFileUrl = (media: ClinicMedia, size?: keyof NonNullable<ClinicMedia['sizes']>): string | null => {
  const sized = size ? media.sizes?.[size] : undefined
  const directUrl = sized?.url ?? (!size ? media.url : null)
  const filename = sized?.filename ?? (!size ? media.filename : null)

  if (typeof directUrl === 'string' && directUrl.trim()) {
    return new URL(versionPayloadMediaFileUrl(directUrl, media.updatedAt), getServerSideURL()).toString()
  }
  if (typeof filename === 'string' && filename.trim()) {
    return new URL(
      versionPayloadMediaFileUrl(`/api/clinicMedia/file/${filename}`, media.updatedAt),
      getServerSideURL(),
    ).toString()
  }
  return null
}

const mediaDTO = (media: ClinicMedia): ClinicGalleryMediaDTO => {
  const descriptor = resolveMediaDescriptorFromLoadedRelation(media, 'clinicMedia')
  const sourceUrl = descriptor?.url ?? mediaFileUrl(media)
  if (!sourceUrl) throw new ClinicGalleryServiceError('unavailable', 'A clinic gallery image is unavailable.')
  const url = new URL(sourceUrl, getServerSideURL()).toString()

  const captionText = richTextToPlainText(media.caption)
  const thumbnailUrl = mediaFileUrl(media, 'thumbnail')

  return {
    alt: typeof media.alt === 'string' ? media.alt : '',
    ...(captionText ? { captionText } : {}),
    ...(typeof media.height === 'number' ? { height: media.height } : {}),
    id: String(media.id),
    status: media.status === 'published' ? 'published' : 'draft',
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    url,
    ...(typeof media.width === 'number' ? { width: media.width } : {}),
  }
}

const readGalleryMedia = async (
  req: PayloadRequest,
  clinicId: RelationId,
  galleryIds: readonly RelationId[],
): Promise<ClinicMedia[]> => {
  if (galleryIds.length === 0) return []

  const result = await req.payload.find({
    collection: 'clinicMedia',
    depth: 0,
    limit: galleryIds.length,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [{ id: { in: [...galleryIds] } }, { clinic: { equals: clinicId } }, { status: { equals: 'published' } }],
    },
  })

  const mediaById = new Map(result.docs.map((media) => [String(media.id), media]))
  const ordered = galleryIds
    .map((id) => mediaById.get(String(id)))
    .filter((media): media is ClinicMedia => Boolean(media))
  if (ordered.length !== galleryIds.length) {
    throw new ClinicGalleryServiceError('unavailable', 'The clinic gallery contains unavailable images.')
  }
  return ordered
}

const readAbandonedDraftIds = async (
  req: PayloadRequest,
  clinicId: RelationId,
  referencedIds: readonly RelationId[],
): Promise<string[]> => {
  const abandonedBefore = new Date(Date.now() - CLINIC_GALLERY_ABANDONED_DRAFT_MIN_AGE_MS).toISOString()
  const drafts = await req.payload.find({
    collection: 'clinicMedia',
    depth: 0,
    limit: clinicGalleryConstraints.maxItems,
    overrideAccess: true,
    pagination: false,
    req,
    sort: 'createdAt',
    where: {
      and: [
        { clinic: { equals: clinicId } },
        { status: { equals: 'draft' } },
        { createdAt: { less_than: abandonedBefore } },
      ],
    },
  })
  const referenced = new Set(referencedIds.map(String))
  return drafts.docs.map((draft) => String(draft.id)).filter((id) => !referenced.has(id))
}

const snapshotFromContext = async (req: PayloadRequest, context: GalleryContext): Promise<ClinicGallerySnapshotDTO> => {
  const media = await readGalleryMedia(req, context.clinic.id, context.galleryIds)
  return {
    constraints: clinicGalleryConstraints,
    items: media.map(mediaDTO),
    revision: context.clinic.profileRevision ?? 0,
  }
}

export const readClinicGallerySnapshot = async (
  req: PayloadRequest,
  clinicId: RelationId,
): Promise<ClinicGalleryReadResult> => {
  const context = await readGalleryContext(req, clinicId)
  const [snapshot, cleanupCandidateIds] = await Promise.all([
    snapshotFromContext(req, context),
    readAbandonedDraftIds(req, clinicId, context.galleryIds),
  ])
  return { cleanupCandidateIds, snapshot }
}

export const uploadClinicGalleryDraft = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicGalleryUploadInput,
  file: RequestFile,
): Promise<ClinicGalleryMediaDTO> => {
  const existingDrafts = await req.payload.count({
    collection: 'clinicMedia',
    overrideAccess: true,
    req,
    where: {
      and: [{ clinic: { equals: clinicId } }, { status: { equals: 'draft' } }],
    },
  })
  if (existingDrafts.totalDocs >= clinicGalleryConstraints.maxItems) {
    throw new ClinicGalleryServiceError('invalid-input', 'Too many unfinished clinic gallery uploads.')
  }

  const media = (await req.payload.create({
    collection: 'clinicMedia',
    data: {
      ...(input.alt ? { alt: input.alt } : {}),
      ...(input.captionText
        ? {
            caption: preserveOrCanonicalizeDescription({
              existing: null,
              nextText: input.captionText,
            }) as ClinicMedia['caption'],
          }
        : {}),
      clinic: Number(clinicId),
      status: 'draft',
    },
    depth: 0,
    draft: false,
    file: file as never,
    overrideAccess: true,
    req,
  } as Parameters<Payload['create']>[0])) as ClinicMedia

  return mediaDTO(media)
}

const duplicateIds = (ids: readonly string[]): boolean => new Set(ids).size !== ids.length

const requirePublishableMedia = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicGallerySaveInput,
): Promise<ClinicMedia[]> => {
  const ids = input.items.map((item) => item.mediaId)
  if (duplicateIds(ids) || input.items.some((item) => !item.alt.trim())) {
    throw new ClinicGalleryServiceError('invalid-input', 'Gallery images and alt text are invalid.')
  }
  if (ids.length === 0) return []

  const result = await req.payload.find({
    collection: 'clinicMedia',
    depth: 0,
    limit: ids.length,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [{ id: { in: ids.map(payloadId) } }, { clinic: { equals: clinicId } }],
    },
  })
  const byId = new Map(result.docs.map((media) => [String(media.id), media]))
  const ordered = ids.map((id) => byId.get(id)).filter((media): media is ClinicMedia => Boolean(media))
  if (ordered.length !== ids.length) {
    throw new ClinicGalleryServiceError('not-found', 'A selected clinic gallery image does not exist.')
  }
  return ordered
}

const isSerializationFailure = (error: unknown): boolean => {
  const visited = new Set<unknown>()
  let current = error
  while (current !== null && typeof current !== 'undefined' && !visited.has(current)) {
    visited.add(current)
    if (typeof current !== 'object' && typeof current !== 'function') return false
    const record = current as Record<string, unknown>
    if (record.code === '40001' || record.sqlState === '40001' || record.sqlstate === '40001') return true
    current = record.cause
  }
  return false
}

const runSerializableTransaction = async <Result>(
  req: PayloadRequest,
  command: () => Promise<Result>,
): Promise<Result> => {
  if (typeof req.transactionID !== 'undefined') {
    throw new ClinicGalleryServiceError('unavailable', 'Gallery updates cannot join another transaction.')
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let transactionID: null | number | string = null
    try {
      transactionID = await req.payload.db.beginTransaction({
        accessMode: 'read write',
        isolationLevel: 'serializable',
      })
      if (transactionID === null) {
        throw new ClinicGalleryServiceError('unavailable', 'A gallery transaction could not be started.')
      }
      req.transactionID = transactionID
      const result = await command()
      await req.payload.db.commitTransaction(transactionID)
      return result
    } catch (error: unknown) {
      if (transactionID !== null) await req.payload.db.rollbackTransaction(transactionID)
      if (isSerializationFailure(error)) {
        if (attempt < 3) continue
        throw new ClinicGalleryServiceError('conflict', 'The clinic gallery changed.')
      }
      throw error
    } finally {
      if (transactionID !== null && req.transactionID === transactionID) delete req.transactionID
    }
  }

  throw new ClinicGalleryServiceError('conflict', 'The clinic gallery changed.')
}

export const saveClinicGallery = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicGallerySaveInput,
): Promise<ClinicGallerySaveResult> => {
  const result = await runSerializableTransaction(req, async () => {
    const context = await readGalleryContext(req, clinicId)
    if ((context.clinic.profileRevision ?? 0) !== input.expectedRevision) {
      throw new ClinicGalleryServiceError('conflict', 'The clinic gallery changed.')
    }

    const selectedMedia = await requirePublishableMedia(req, clinicId, input)
    const selectedIds = selectedMedia.map((media) => media.id)
    const selectedIdSet = new Set(selectedIds.map(String))
    const removedIds = context.galleryIds.filter((id) => !selectedIdSet.has(String(id)))
    const inputById = new Map(input.items.map((item) => [item.mediaId, item]))

    const publishedMedia: ClinicMedia[] = []
    for (const media of selectedMedia) {
      const item = inputById.get(String(media.id))
      if (!item) throw new ClinicGalleryServiceError('invalid-input', 'A selected clinic gallery image is invalid.')
      const nextAlt = item.alt.trim()
      const nextCaptionText = item.captionText?.trim() ?? ''
      const mediaNeedsUpdate =
        media.status !== 'published' ||
        media.alt?.trim() !== nextAlt ||
        richTextToPlainText(media.caption) !== nextCaptionText

      if (!mediaNeedsUpdate) {
        publishedMedia.push(media)
        continue
      }

      const updatedMedia = (await req.payload.update({
        collection: 'clinicMedia',
        context: { disableRevalidate: true },
        data: {
          alt: nextAlt,
          caption: preserveOrCanonicalizeDescription({
            existing: media.caption,
            nextText: nextCaptionText,
          }) as ClinicMedia['caption'],
          status: 'published',
        },
        depth: 0,
        id: media.id,
        overrideAccess: true,
        req,
      })) as ClinicMedia
      publishedMedia.push(updatedMedia)
    }

    const clinicUpdate = await req.payload.update({
      collection: 'clinics',
      context: { disableRevalidate: true },
      data: {
        profileGallery: selectedIds,
      },
      depth: 0,
      overrideAccess: true,
      req,
      where: {
        and: [{ id: { equals: context.clinic.id } }, { profileRevision: { equals: input.expectedRevision } }],
      },
    })
    const updatedClinic = clinicUpdate.docs[0]
    if (!updatedClinic || clinicUpdate.docs.length !== 1) {
      throw new ClinicGalleryServiceError('conflict', 'The clinic gallery changed.')
    }

    for (const removedId of removedIds) {
      await req.payload.update({
        collection: 'clinicMedia',
        context: { disableRevalidate: true },
        data: { status: 'draft' },
        depth: 0,
        id: removedId,
        overrideAccess: true,
        req,
      })
    }

    const previousMainId = String(context.galleryIds[0] ?? '')
    const nextMainId = String(selectedIds[0] ?? '')
    const nextMainInput = inputById.get(nextMainId)
    const previousMainMedia = selectedMedia.find((media) => String(media.id) === previousMainId)
    const mainImageChanged =
      previousMainId !== nextMainId ||
      Boolean(
        nextMainId && previousMainMedia && nextMainInput && previousMainMedia.alt?.trim() !== nextMainInput.alt.trim(),
      )

    return {
      mainImageChanged,
      previousClinic: context.clinic,
      removedMediaIds: removedIds.map(String),
      snapshot: {
        constraints: clinicGalleryConstraints,
        items: publishedMedia.map(mediaDTO),
        revision: updatedClinic.profileRevision ?? input.expectedRevision + 1,
      },
      updatedClinic,
    }
  })

  dispatchClinicGalleryChangeRevalidation({
    doc: result.updatedClinic,
    mainImageChanged: result.mainImageChanged,
    previousDoc: result.previousClinic,
    req,
  })

  return {
    cleanupCandidateIds: result.removedMediaIds.slice(0, clinicGalleryConstraints.maxItems),
    removedMediaIds: result.removedMediaIds,
    snapshot: result.snapshot,
  }
}

export const discardClinicGalleryDrafts = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicGalleryDiscardInput,
): Promise<string[]> => {
  const ids = [...new Set(input.mediaIds)]
  if (ids.length !== input.mediaIds.length) {
    throw new ClinicGalleryServiceError('invalid-input', 'Draft gallery image identifiers must be unique.')
  }

  const [context, media] = await Promise.all([
    readGalleryContext(req, clinicId),
    req.payload.find({
      collection: 'clinicMedia',
      depth: 0,
      limit: ids.length,
      overrideAccess: true,
      pagination: false,
      req,
      where: {
        and: [{ id: { in: ids.map(payloadId) } }, { clinic: { equals: clinicId } }, { status: { equals: 'draft' } }],
      },
    }),
  ])

  const found = new Set(media.docs.map((item) => String(item.id)))
  const referenced = new Set([...context.galleryIds.map(String), String(relationId(context.clinic.thumbnail) ?? '')])
  if (ids.some((id) => !found.has(id) || referenced.has(id))) {
    throw new ClinicGalleryServiceError('not-found', 'A draft clinic gallery image does not exist.')
  }

  return ids
}
