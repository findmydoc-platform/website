import { after } from 'next/server.js'
import { addDataAndFileToRequest, type PayloadHandler, type PayloadRequest } from 'payload'
import type { ZodType } from 'zod'

import { MEDIA_UPLOAD_TOO_LARGE_MESSAGE } from '@/config/mediaUploadPolicy'
import { resolveClinicDashboardBootstrap, type ClinicDashboardCapability } from '@/features/clinicDashboard/bootstrap'
import {
  cleanupClinicGalleryDraftMedia,
  type ClinicGalleryCleanupReason,
} from '@/features/clinicDashboard/gallery/cleanup'
import {
  clinicGalleryDiscardInputSchema,
  clinicGallerySaveInputSchema,
  clinicGalleryUploadInputSchema,
} from '@/features/clinicDashboard/gallery/contracts'
import {
  ClinicGalleryServiceError,
  discardClinicGalleryDrafts,
  readClinicGallerySnapshot,
  saveClinicGallery,
  uploadClinicGalleryDraft,
} from '@/features/clinicDashboard/gallery/service'
import { sendPostHogException } from '@/posthog/api'
import { toLoggedError } from '@/utilities/logging/shared'
import type { RequestFile } from '@/utilities/requestFileUtils'
import { CLINIC_DASHBOARD_ERROR_CODES, clinicDashboardPrivateJsonResponse } from './clinicDashboardBootstrap'

export const CLINIC_GALLERY_ERROR_CODES = {
  conflict: 'CLINIC_GALLERY_CONFLICT',
  invalidInput: 'CLINIC_GALLERY_INVALID_INPUT',
  mediaNotFound: 'CLINIC_GALLERY_MEDIA_NOT_FOUND',
  unavailable: 'CLINIC_GALLERY_UNAVAILABLE',
  unsupportedMediaType: 'CLINIC_GALLERY_UNSUPPORTED_MEDIA_TYPE',
  uploadTooLarge: 'CLINIC_GALLERY_UPLOAD_TOO_LARGE',
} as const

type AuthorizedClinic =
  | { ok: true; clinicId: string }
  | {
      ok: false
      response: Response
    }

const authorizeClinic = async (
  req: PayloadRequest,
  requiredCapability: ClinicDashboardCapability,
): Promise<AuthorizedClinic> => {
  const result = await resolveClinicDashboardBootstrap(req)

  switch (result.status) {
    case 'success':
      return result.data.capabilities.includes(requiredCapability)
        ? { ok: true, clinicId: result.data.clinic.id }
        : {
            ok: false,
            response: clinicDashboardPrivateJsonResponse(
              { error: { code: CLINIC_DASHBOARD_ERROR_CODES.accessDenied } },
              403,
            ),
          }
    case 'access-denied':
      return {
        ok: false,
        response: clinicDashboardPrivateJsonResponse(
          { error: { code: CLINIC_DASHBOARD_ERROR_CODES.accessDenied } },
          403,
        ),
      }
    case 'unavailable':
      return {
        ok: false,
        response: clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.unavailable } }, 503),
      }
    case 'unauthorized':
      return {
        ok: false,
        response: clinicDashboardPrivateJsonResponse(
          { error: { code: CLINIC_DASHBOARD_ERROR_CODES.unauthorized } },
          401,
        ),
      }
  }
}

const readBody = async <T>(req: PayloadRequest, schema: ZodType<T>): Promise<T | Response> => {
  const body = typeof req.json === 'function' ? await req.json().catch(() => undefined) : undefined
  const parsed = schema.safeParse(body)
  return parsed.success
    ? parsed.data
    : clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.invalidInput } }, 400)
}

const requestFiles = (req: PayloadRequest): RequestFile[] => {
  const files = new Set<RequestFile>()
  const add = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(add)
      return
    }
    if (value && typeof value === 'object') files.add(value as RequestFile)
  }
  add(req.file)
  if (req.files && typeof req.files === 'object') Object.values(req.files).forEach(add)
  return [...files]
}

const serviceErrorResponse = (error: ClinicGalleryServiceError): Response => {
  switch (error.kind) {
    case 'conflict':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.conflict } }, 409)
    case 'invalid-input':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.invalidInput } }, 422)
    case 'not-found':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.mediaNotFound } }, 404)
    case 'unavailable':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.unavailable } }, 503)
  }
}

const uploadErrorResponse = (error: unknown): Response | null => {
  if (!error || typeof error !== 'object') return null
  const record = error as { message?: unknown; status?: unknown }
  const message = typeof record.message === 'string' ? record.message : ''
  if (record.status === 413 || message === MEDIA_UPLOAD_TOO_LARGE_MESSAGE) {
    return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.uploadTooLarge } }, 413)
  }
  if (record.status === 400 && /unsupported image format/iu.test(message)) {
    return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.unsupportedMediaType } }, 415)
  }
  if (record.status === 400) {
    return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.invalidInput } }, 400)
  }
  return null
}

const unexpectedErrorResponse = (req: PayloadRequest, error: unknown, operation: string): Response => {
  req.payload.logger.error(
    {
      err: toLoggedError(error),
      event: `clinic_dashboard.gallery.${operation}_failed`,
    },
    'Clinic Dashboard gallery operation failed',
  )
  return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.unavailable } }, 503)
}

const scheduleCleanup = (
  req: PayloadRequest,
  clinicId: string,
  mediaIds: readonly string[],
  reason: ClinicGalleryCleanupReason,
): void => {
  if (mediaIds.length === 0) return

  try {
    after(async () => {
      try {
        await cleanupClinicGalleryDraftMedia(req.payload, clinicId, mediaIds, reason, {
          logger: req.payload.logger,
        })
      } catch (error: unknown) {
        req.payload.logger.error(
          {
            clinicId,
            err: toLoggedError(error),
            event: 'clinic_gallery.cleanup_batch_failed',
            reason,
          },
          'Clinic gallery cleanup batch failed',
        )
        await sendPostHogException(error, {
          distinctId: `clinic:${clinicId}`,
          properties: { clinicId, event: 'clinic_gallery.cleanup_batch_failed', reason },
        })
      }
    })
  } catch (error: unknown) {
    req.payload.logger.error(
      {
        clinicId,
        err: toLoggedError(error),
        event: 'clinic_gallery.cleanup_schedule_failed',
        reason,
      },
      'Clinic gallery cleanup could not be scheduled',
    )
  }
}

export const clinicDashboardGalleryGetHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-gallery:view')
  if (!authorization.ok) return authorization.response

  try {
    const result = await readClinicGallerySnapshot(req, authorization.clinicId)
    scheduleCleanup(req, authorization.clinicId, result.cleanupCandidateIds, 'gallery-read')
    return clinicDashboardPrivateJsonResponse(result.snapshot, 200)
  } catch (error: unknown) {
    if (error instanceof ClinicGalleryServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'read')
  }
}

export const clinicDashboardGalleryMediaPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-gallery:edit')
  if (!authorization.ok) return authorization.response

  try {
    await addDataAndFileToRequest(req)
    const parsed = clinicGalleryUploadInputSchema.safeParse(req.data ?? {})
    const files = requestFiles(req)
    if (!parsed.success || files.length !== 1) {
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_GALLERY_ERROR_CODES.invalidInput } }, 400)
    }
    const media = await uploadClinicGalleryDraft(req, authorization.clinicId, parsed.data, files[0] as RequestFile)
    return clinicDashboardPrivateJsonResponse(media, 201)
  } catch (error: unknown) {
    if (error instanceof ClinicGalleryServiceError) return serviceErrorResponse(error)
    const uploadResponse = uploadErrorResponse(error)
    if (uploadResponse) return uploadResponse
    return unexpectedErrorResponse(req, error, 'upload')
  }
}

export const clinicDashboardGalleryPutHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-gallery:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, clinicGallerySaveInputSchema)
  if (input instanceof Response) return input

  try {
    const result = await saveClinicGallery(req, authorization.clinicId, input)
    scheduleCleanup(req, authorization.clinicId, result.cleanupCandidateIds, 'gallery-save')
    return clinicDashboardPrivateJsonResponse(result.snapshot, 200)
  } catch (error: unknown) {
    if (error instanceof ClinicGalleryServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'save')
  }
}

export const clinicDashboardGalleryDiscardPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-gallery:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, clinicGalleryDiscardInputSchema)
  if (input instanceof Response) return input

  try {
    const mediaIds = await discardClinicGalleryDrafts(req, authorization.clinicId, input)
    scheduleCleanup(req, authorization.clinicId, mediaIds, 'discard')
    return clinicDashboardPrivateJsonResponse({ mediaIds }, 202)
  } catch (error: unknown) {
    if (error instanceof ClinicGalleryServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'discard')
  }
}
