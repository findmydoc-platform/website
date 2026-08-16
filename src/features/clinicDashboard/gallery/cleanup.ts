import type { Payload } from 'payload'

import { relationId } from '@/collections/clinics/profileGallery'
import { sendPostHogException } from '@/posthog/api'
import { toLoggedError, type ServerLogger } from '@/utilities/logging/shared'

export const CLINIC_GALLERY_CLEANUP_BATCH_SIZE = 12
export const CLINIC_GALLERY_CLEANUP_CONCURRENCY = 3
export const CLINIC_GALLERY_CLEANUP_RETRY_DELAYS_MS = [250, 1_000] as const

export type ClinicGalleryCleanupReason = 'discard' | 'gallery-read' | 'gallery-save'

type CleanupOptions = {
  logger?: ServerLogger
  random?: () => number
  sleep?: (milliseconds: number) => Promise<void>
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

const payloadId = (value: string): string | number => {
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : value
}

const isNotFound = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'status' in error && error.status === 404)

const canDelete = async (payload: Payload, clinicId: string | number, mediaId: string): Promise<boolean> => {
  let media
  try {
    media = await payload.findByID({
      collection: 'clinicMedia',
      depth: 0,
      id: payloadId(mediaId),
      overrideAccess: true,
      trash: true,
    })
  } catch (error: unknown) {
    if (isNotFound(error)) return false
    throw error
  }

  if (media.status !== 'draft' || String(relationId(media.clinic)) !== String(clinicId)) return false

  const clinics = await payload.find({
    collection: 'clinics',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    trash: true,
    where: {
      and: [
        { id: { equals: clinicId } },
        {
          or: [{ profileGallery: { contains: payloadId(mediaId) } }, { thumbnail: { equals: payloadId(mediaId) } }],
        },
      ],
    },
  })

  return clinics.docs.length === 0
}

const cleanupOne = async ({
  clinicId,
  logger,
  mediaId,
  payload,
  random,
  reason,
  sleep,
}: {
  clinicId: string | number
  logger: ServerLogger
  mediaId: string
  payload: Payload
  random: () => number
  reason: ClinicGalleryCleanupReason
  sleep: (milliseconds: number) => Promise<void>
}): Promise<void> => {
  const attempts = CLINIC_GALLERY_CLEANUP_RETRY_DELAYS_MS.length + 1
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (!(await canDelete(payload, clinicId, mediaId))) return

      await payload.delete({
        collection: 'clinicMedia',
        context: { disableRevalidate: true },
        id: payloadId(mediaId),
        overrideAccess: true,
        trash: true,
      })
      return
    } catch (error: unknown) {
      lastError = error
      if (attempt >= attempts) break
      const baseDelay = CLINIC_GALLERY_CLEANUP_RETRY_DELAYS_MS[attempt - 1] ?? 0
      const jitter = 0.9 + random() * 0.2
      await sleep(Math.round(baseDelay * jitter))
    }
  }

  const cleanupError = lastError instanceof Error ? lastError : new Error(String(lastError))
  logger.error(
    {
      attemptCount: attempts,
      clinicId: String(clinicId),
      err: toLoggedError(cleanupError),
      event: 'clinic_gallery.media_cleanup_failed',
      mediaId,
      reason,
    },
    'Clinic gallery media cleanup failed',
  )
  await sendPostHogException(cleanupError, {
    distinctId: `clinic:${String(clinicId)}`,
    properties: {
      attemptCount: attempts,
      clinicId: String(clinicId),
      event: 'clinic_gallery.media_cleanup_failed',
      mediaId,
      reason,
    },
  })
}

export const cleanupClinicGalleryDraftMedia = async (
  payload: Payload,
  clinicId: string | number,
  mediaIds: readonly string[],
  reason: ClinicGalleryCleanupReason,
  options: CleanupOptions = {},
): Promise<void> => {
  const ids = [...new Set(mediaIds.map((id) => id.trim()).filter(Boolean))].slice(0, CLINIC_GALLERY_CLEANUP_BATCH_SIZE)
  if (ids.length === 0) return

  const logger = options.logger ?? (payload.logger as ServerLogger)
  const random = options.random ?? Math.random
  const sleep = options.sleep ?? defaultSleep
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < ids.length) {
      const mediaId = ids[cursor]
      cursor += 1
      if (mediaId) await cleanupOne({ clinicId, logger, mediaId, payload, random, reason, sleep })
    }
  }

  await Promise.all(Array.from({ length: Math.min(CLINIC_GALLERY_CLEANUP_CONCURRENCY, ids.length) }, worker))
}
