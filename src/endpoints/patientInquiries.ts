import { after } from 'next/server.js'
import type { PayloadHandler, PayloadRequest } from 'payload'
import type { ZodType } from 'zod'

import {
  attachmentDraftCreateInputSchema,
  attachmentDraftMutationInputSchema,
  externalMessageInputSchema,
  inquiryDetailInputSchema,
  inquiryReadPositionInputSchema,
  patientInquiryQueueInputSchema,
  verifiedInquiryCreateInputSchema,
  type InquiryCommunicationErrorCode,
} from '@/features/inquiryCommunication/contracts'
import {
  cleanupDiscardedAttachment,
  createVerifiedPatientInquiry,
  createAttachmentDraft,
  discardAttachmentDraft,
  finalizeAttachmentDraft,
  InquiryCommunicationServiceError,
  readPatientInquiryDetailResult,
  readPatientInquiryQueue,
  sendPatientInquiryMessage,
  sweepExpiredAttachmentDrafts,
  updatePatientInquiryReadPosition,
} from '@/features/inquiryCommunication/service'
import { reconcileExpiredInquiryModerationMeasures } from '@/features/inquiryModeration/service'
import { toLoggedError } from '@/utilities/logging/shared'
import { proxyInquiryAttachment } from './inquiryAttachmentProxy'

type AuthorizationResult = { ok: true } | { ok: false; response: Response }

type ErrorDescription = {
  code: InquiryCommunicationErrorCode
  status: number
}

export const PATIENT_INQUIRY_PRIVATE_LIVE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Expires: '0',
  Pragma: 'no-cache',
  Vary: 'Authorization, Cookie',
} as const

const ERROR_DESCRIPTIONS = {
  'access-denied': { code: 'INQUIRY_ACCESS_DENIED', status: 403 },
  conflict: { code: 'INQUIRY_CONFLICT', status: 409 },
  'invalid-input': { code: 'INQUIRY_INVALID_INPUT', status: 400 },
  'invalid-state': { code: 'INQUIRY_INVALID_STATE', status: 409 },
  'not-found': { code: 'INQUIRY_NOT_FOUND', status: 404 },
  'payload-too-large': { code: 'INQUIRY_PAYLOAD_TOO_LARGE', status: 413 },
  'rate-limited': { code: 'INQUIRY_RATE_LIMITED', status: 429 },
  'reauthentication-required': { code: 'INQUIRY_REAUTHENTICATION_REQUIRED', status: 401 },
  'service-timeout': { code: 'INQUIRY_SERVICE_TIMEOUT', status: 504 },
  unavailable: { code: 'INQUIRY_SERVICE_UNAVAILABLE', status: 503 },
  'unsupported-media-type': { code: 'INQUIRY_UNSUPPORTED_MEDIA_TYPE', status: 415 },
  unauthorized: { code: 'INQUIRY_UNAUTHORIZED', status: 401 },
} as const satisfies Record<string, ErrorDescription>

const patientPrivateJsonResponse = (body: unknown, status: number): Response =>
  Response.json(body, { status, headers: PATIENT_INQUIRY_PRIVATE_LIVE_HEADERS })

const inquiryErrorResponse = (
  description: ErrorDescription,
  current?: InquiryCommunicationServiceError['current'],
): Response =>
  patientPrivateJsonResponse(
    {
      error: {
        code: description.code,
        ...(current ? { current } : {}),
      },
    },
    description.status,
  )

const authorizePatient = (req: PayloadRequest): AuthorizationResult => {
  if (!req.user) return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS.unauthorized) }
  if (req.user.collection !== 'patients') {
    return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS['access-denied']) }
  }
  return { ok: true }
}

const invalidInputResponse = (): Response => inquiryErrorResponse(ERROR_DESCRIPTIONS['invalid-input'])

const readBody = async <Value>(req: PayloadRequest, schema: ZodType<Value>): Promise<Response | Value> => {
  const body = typeof req.json === 'function' ? await req.json().catch(() => undefined) : undefined
  const parsed = schema.safeParse(body)
  return parsed.success ? parsed.data : invalidInputResponse()
}

const hasOnlyAllowedSearchParams = (req: PayloadRequest, allowed: ReadonlySet<string>): boolean => {
  const keys = new Set(req.searchParams.keys())
  return [...keys].every((key) => allowed.has(key))
}

const oneSearchParam = (req: PayloadRequest, key: string): string | undefined | null => {
  const values = req.searchParams.getAll(key)
  if (values.length > 1) return null
  return values[0]
}

const parseInteger = (value: string | undefined): number | undefined | null => {
  if (typeof value === 'undefined') return undefined
  if (!/^\d+$/u.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

const readQueueInput = (req: PayloadRequest): Response | ReturnType<typeof patientInquiryQueueInputSchema.parse> => {
  const allowed = new Set(['cursor', 'lifecycle', 'limit'])
  if (!hasOnlyAllowedSearchParams(req, allowed)) return invalidInputResponse()

  const cursor = oneSearchParam(req, 'cursor')
  const lifecycle = oneSearchParam(req, 'lifecycle')
  const limitValue = oneSearchParam(req, 'limit')
  if ([cursor, lifecycle, limitValue].includes(null)) return invalidInputResponse()
  const limit = parseInteger(limitValue ?? undefined)
  if (limit === null) return invalidInputResponse()

  const parsed = patientInquiryQueueInputSchema.safeParse({
    ...(typeof cursor === 'string' ? { cursor } : {}),
    ...(typeof lifecycle === 'string' ? { lifecycle } : {}),
    ...(typeof limit === 'number' ? { limit } : {}),
  })
  return parsed.success ? parsed.data : invalidInputResponse()
}

const readDetailInput = (req: PayloadRequest): Response | ReturnType<typeof inquiryDetailInputSchema.parse> => {
  const allowed = new Set(['inquiryId', 'knownChangeCursor', 'knownRevision'])
  if (!hasOnlyAllowedSearchParams(req, allowed)) return invalidInputResponse()

  const inquiryId = oneSearchParam(req, 'inquiryId')
  const knownChangeCursor = oneSearchParam(req, 'knownChangeCursor')
  const knownRevisionValue = oneSearchParam(req, 'knownRevision')
  if (inquiryId === null || knownChangeCursor === null || knownRevisionValue === null) return invalidInputResponse()
  const knownRevision = parseInteger(knownRevisionValue)
  if (knownRevision === null) return invalidInputResponse()

  const parsed = inquiryDetailInputSchema.safeParse({
    inquiryId,
    ...(typeof knownChangeCursor === 'string' ? { knownChangeCursor } : {}),
    ...(typeof knownRevision === 'number' ? { knownRevision } : {}),
  })
  return parsed.success ? parsed.data : invalidInputResponse()
}

const readAttachmentId = (req: PayloadRequest): Response | string => {
  const allowed = new Set(['attachmentId'])
  if (!hasOnlyAllowedSearchParams(req, allowed)) return invalidInputResponse()
  const attachmentId = oneSearchParam(req, 'attachmentId')
  const parsed = inquiryDetailInputSchema.shape.inquiryId.safeParse(attachmentId)
  return parsed.success ? parsed.data : invalidInputResponse()
}

const serviceErrorResponse = (error: InquiryCommunicationServiceError): Response => {
  const description = ERROR_DESCRIPTIONS[error.kind as keyof typeof ERROR_DESCRIPTIONS]
  return inquiryErrorResponse(description ?? ERROR_DESCRIPTIONS.unavailable, error.current)
}

const unexpectedErrorResponse = (req: PayloadRequest, error: unknown, operation: string): Response => {
  req.payload.logger.error(
    {
      err: toLoggedError(error),
      event: `patient.inquiries.${operation}_failed`,
    },
    'Patient inquiry operation failed',
  )
  return inquiryErrorResponse(ERROR_DESCRIPTIONS.unavailable)
}

const execute = async <Value>(
  req: PayloadRequest,
  operation: string,
  command: () => Promise<Value>,
  success: (value: Value) => Response = (value) => patientPrivateJsonResponse(value, 200),
): Promise<Response> => {
  try {
    return success(await command())
  } catch (error: unknown) {
    if (error instanceof InquiryCommunicationServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, operation)
  }
}

const sweepAttachments = async (req: PayloadRequest): Promise<void> => {
  try {
    await sweepExpiredAttachmentDrafts(req)
  } catch (error: unknown) {
    req.payload.logger.error(
      { err: toLoggedError(error), event: 'patient.inquiries.attachment_sweep_failed' },
      'Expired patient inquiry attachment sweep failed',
    )
  }
}

const scheduleAttachmentSweep = (req: PayloadRequest): void => {
  after(() => sweepAttachments(req))
}

const scheduleModerationReconciliation = (req: PayloadRequest, inquiryId: string): void => {
  after(async () => {
    try {
      await reconcileExpiredInquiryModerationMeasures(req, { inquiryId })
    } catch (error: unknown) {
      req.payload.logger.error(
        { err: toLoggedError(error), event: 'patient.inquiries.moderation_reconciliation_failed' },
        'Expired patient inquiry moderation reconciliation failed',
      )
    }
  })
}

const scheduleDiscardCleanup = (req: PayloadRequest, attachmentId: string): void => {
  after(async () => {
    try {
      await cleanupDiscardedAttachment(req, { attachmentId })
    } catch (error: unknown) {
      req.payload.logger.error(
        { err: toLoggedError(error), event: 'patient.inquiries.attachment_discard_cleanup_failed' },
        'Discarded patient inquiry attachment cleanup failed',
      )
    }
    await sweepAttachments(req)
  })
}

export const patientInquiriesGetHandler: PayloadHandler = async (req) => {
  const authorization = authorizePatient(req)
  if (!authorization.ok) return authorization.response
  const input = readQueueInput(req)
  if (input instanceof Response) return input
  return execute(req, 'queue_read', () => readPatientInquiryQueue(req, input))
}

export const patientInquiryCreatePostHandler: PayloadHandler = async (req) => {
  const authorization = authorizePatient(req)
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, verifiedInquiryCreateInputSchema)
  if (input instanceof Response) return input
  return execute(
    req,
    'create',
    () => createVerifiedPatientInquiry(req, input),
    (value) => patientPrivateJsonResponse(value, value.replayed ? 200 : 201),
  )
}

export const patientInquiryDetailGetHandler: PayloadHandler = async (req) => {
  const authorization = authorizePatient(req)
  if (!authorization.ok) return authorization.response
  const input = readDetailInput(req)
  if (input instanceof Response) return input
  return execute(req, 'detail_read', async () => {
    const result = await readPatientInquiryDetailResult(req, input)
    scheduleModerationReconciliation(req, input.inquiryId)
    return result
  })
}

export const patientInquiryMessagesPostHandler: PayloadHandler = async (req) => {
  const authorization = authorizePatient(req)
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, externalMessageInputSchema)
  if (input instanceof Response) return input
  return execute(req, 'message_send', () => sendPatientInquiryMessage(req, input))
}

export const patientInquiryReadPositionPutHandler: PayloadHandler = async (req) => {
  const authorization = authorizePatient(req)
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, inquiryReadPositionInputSchema)
  if (input instanceof Response) return input
  return execute(
    req,
    'read_position_update',
    () => updatePatientInquiryReadPosition(req, input),
    (value) => patientPrivateJsonResponse({ unread: value.inquiry.unread }, 200),
  )
}

export const patientInquiryAttachmentDraftPostHandler: PayloadHandler = async (req) => {
  const authorization = authorizePatient(req)
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, attachmentDraftCreateInputSchema)
  if (input instanceof Response) return input
  return execute(
    req,
    'attachment_draft_create',
    () => createAttachmentDraft(req, input),
    (value) => {
      scheduleAttachmentSweep(req)
      return patientPrivateJsonResponse(value, 201)
    },
  )
}

export const patientInquiryAttachmentFinalizePostHandler: PayloadHandler = async (req) => {
  const authorization = authorizePatient(req)
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, attachmentDraftMutationInputSchema)
  if (input instanceof Response) return input
  return execute(
    req,
    'attachment_draft_finalize',
    () => finalizeAttachmentDraft(req, input),
    () => {
      scheduleAttachmentSweep(req)
      return patientPrivateJsonResponse({ finalized: true }, 200)
    },
  )
}

export const patientInquiryAttachmentDiscardPostHandler: PayloadHandler = async (req) => {
  const authorization = authorizePatient(req)
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, attachmentDraftMutationInputSchema)
  if (input instanceof Response) return input
  return execute(
    req,
    'attachment_draft_discard',
    () => discardAttachmentDraft(req, input),
    (value) => {
      scheduleDiscardCleanup(req, value.attachmentId)
      return patientPrivateJsonResponse({ discarded: true }, 200)
    },
  )
}

export const patientInquiryAttachmentDownloadGetHandler: PayloadHandler = async (req) => {
  const authorization = authorizePatient(req)
  if (!authorization.ok) return authorization.response
  const attachmentId = readAttachmentId(req)
  if (attachmentId instanceof Response) return attachmentId
  return execute(
    req,
    'attachment_download',
    () =>
      proxyInquiryAttachment(req, {
        attachmentId,
        mode: 'download',
        responseHeaders: PATIENT_INQUIRY_PRIVATE_LIVE_HEADERS,
      }),
    (response) => {
      scheduleAttachmentSweep(req)
      return response
    },
  )
}
