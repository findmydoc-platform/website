import { after } from 'next/server.js'
import type { PayloadHandler, PayloadRequest } from 'payload'
import type { ZodType } from 'zod'

import { extractTokenFromHeader, validateSupabaseFreshFirstFactor } from '@/auth/utilities/jwtValidation'
import type { ClinicDashboardCapability } from '@/features/clinicDashboard/bootstrap'
import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'
import {
  resolveClinicDashboardContract,
  resolveClinicDashboardInquiryContractVersion,
} from '@/features/clinicDashboard/contractNegotiation'
import {
  attachmentDraftCreateInputSchema,
  attachmentDraftMutationInputSchema,
  clinicInquiryQueueInputSchema,
  externalMessageInputSchema,
  inquiryContactRevealInputSchema,
  inquiryDetailInputSchema,
  inquiryReadPositionInputSchema,
  inquiryStateInputSchema,
  internalNoteInputSchema,
  type InquiryCommunicationErrorCode,
} from '@/features/inquiryCommunication/contracts'
import {
  addClinicInquiryNote,
  cleanupDiscardedAttachment,
  createAttachmentDraft,
  discardAttachmentDraft,
  finalizeAttachmentDraft,
  InquiryCommunicationServiceError,
  readClinicInquiryDetail,
  readClinicInquiryQueue,
  revealClinicInquiryContact,
  sendClinicInquiryMessage,
  sweepExpiredAttachmentDrafts,
  updateClinicInquiryReadPosition,
  updateClinicInquiryState,
} from '@/features/inquiryCommunication/service'
import { reconcileExpiredInquiryModerationMeasures } from '@/features/inquiryModeration/service'
import { toLoggedError } from '@/utilities/logging/shared'
import { CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS, clinicDashboardPrivateJsonResponse } from './clinicDashboardBootstrap'
import { proxyInquiryAttachment } from './inquiryAttachmentProxy'

type AuthorizationResult = { ok: true } | { ok: false; response: Response }

type ErrorDescription = {
  code: InquiryCommunicationErrorCode
  status: number
}

export const CLINIC_INQUIRY_CONTACT_REAUTH_MAX_AGE_SECONDS = 5 * 60

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

const V1_SYSTEM_EVENTS = new Set(['closed', 'handling-status-changed', 'marked-spam', 'reopened', 'spam-removed'])

const projectV1InquiryValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(projectV1InquiryValue)
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      key,
      key === 'timeline' && Array.isArray(item)
        ? item
            .filter(
              (entry) =>
                !entry ||
                typeof entry !== 'object' ||
                (entry as { kind?: unknown }).kind !== 'system-event' ||
                V1_SYSTEM_EVENTS.has(String((entry as { event?: unknown }).event)),
            )
            .map(projectV1InquiryValue)
        : projectV1InquiryValue(item),
    ]),
  )
}

const projectInquiryContractValue = (req: PayloadRequest, value: unknown): unknown =>
  resolveClinicDashboardInquiryContractVersion(req.headers) === 'v1' ? projectV1InquiryValue(value) : value

const inquiryErrorResponse = (
  req: PayloadRequest | null,
  description: ErrorDescription,
  current?: InquiryCommunicationServiceError['current'],
): Response =>
  clinicDashboardPrivateJsonResponse(
    {
      error: {
        code: description.code,
        ...(current ? { current: req ? projectInquiryContractValue(req, current) : current } : {}),
      },
    },
    description.status,
  )

const authorizeClinic = async (
  req: PayloadRequest,
  capability: ClinicDashboardCapability,
): Promise<AuthorizationResult> => {
  if (resolveClinicDashboardContract(req.headers) !== 'inquiry') {
    return { ok: false, response: inquiryErrorResponse(req, ERROR_DESCRIPTIONS['invalid-input']) }
  }
  const result = await revalidateClinicDashboardRequest(req, 'inquiry')

  switch (result.status) {
    case 'authorized': {
      return result.data.capabilities.includes(capability)
        ? { ok: true }
        : { ok: false, response: inquiryErrorResponse(req, ERROR_DESCRIPTIONS['access-denied']) }
    }
    case 'access-denied':
      return { ok: false, response: inquiryErrorResponse(req, ERROR_DESCRIPTIONS['access-denied']) }
    case 'unavailable':
      return { ok: false, response: inquiryErrorResponse(req, ERROR_DESCRIPTIONS.unavailable) }
    case 'unauthorized':
      return { ok: false, response: inquiryErrorResponse(req, ERROR_DESCRIPTIONS.unauthorized) }
  }
}

const requireFreshClinicAuthentication = async (req: PayloadRequest): Promise<AuthorizationResult> => {
  const token = extractTokenFromHeader(req.headers)
  const principal = req.user
  const expectedSubject =
    principal?.collection === 'clinicStaff' && typeof principal.supabaseUserId === 'string'
      ? principal.supabaseUserId.trim()
      : ''
  if (!token || !expectedSubject) {
    return { ok: false, response: inquiryErrorResponse(req, ERROR_DESCRIPTIONS.unauthorized) }
  }

  const result = await validateSupabaseFreshFirstFactor({
    token,
    expectedSubject,
    maxAgeSeconds: CLINIC_INQUIRY_CONTACT_REAUTH_MAX_AGE_SECONDS,
    headers: req.headers,
    logger: req.payload.logger,
  })
  switch (result.status) {
    case 'authenticated':
      return { ok: true }
    case 'invalid':
      return { ok: false, response: inquiryErrorResponse(req, ERROR_DESCRIPTIONS.unauthorized) }
    case 'reauthentication-required':
      return { ok: false, response: inquiryErrorResponse(req, ERROR_DESCRIPTIONS['reauthentication-required']) }
    case 'unavailable':
      return { ok: false, response: inquiryErrorResponse(req, ERROR_DESCRIPTIONS.unavailable) }
  }
}

const invalidInputResponse = (): Response => inquiryErrorResponse(null, ERROR_DESCRIPTIONS['invalid-input'])

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

const parseBoolean = (value: string | undefined): boolean | undefined | null => {
  if (typeof value === 'undefined') return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

const readQueueInput = (req: PayloadRequest): Response | ReturnType<typeof clinicInquiryQueueInputSchema.parse> => {
  const allowed = new Set([
    'cursor',
    'handlingStatus',
    'knownChangeCursor',
    'lifecycle',
    'limit',
    'query',
    'unreadOnly',
  ])
  if (!hasOnlyAllowedSearchParams(req, allowed)) return invalidInputResponse()

  const cursor = oneSearchParam(req, 'cursor')
  const handlingStatus = oneSearchParam(req, 'handlingStatus')
  const knownChangeCursor = oneSearchParam(req, 'knownChangeCursor')
  const lifecycle = oneSearchParam(req, 'lifecycle')
  const limitValue = oneSearchParam(req, 'limit')
  const query = oneSearchParam(req, 'query')
  const unreadOnlyValue = oneSearchParam(req, 'unreadOnly')
  if ([cursor, handlingStatus, knownChangeCursor, lifecycle, limitValue, query, unreadOnlyValue].includes(null)) {
    return invalidInputResponse()
  }

  const limit = parseInteger(limitValue ?? undefined)
  const unreadOnly = parseBoolean(unreadOnlyValue ?? undefined)
  if (limit === null || unreadOnly === null) return invalidInputResponse()

  const parsed = clinicInquiryQueueInputSchema.safeParse({
    ...(typeof cursor === 'string' ? { cursor } : {}),
    ...(typeof handlingStatus === 'string' ? { handlingStatus: handlingStatus.split(',') } : {}),
    ...(typeof knownChangeCursor === 'string' ? { knownChangeCursor } : {}),
    ...(typeof lifecycle === 'string' ? { lifecycle } : {}),
    ...(typeof limit === 'number' ? { limit } : {}),
    ...(typeof query === 'string' ? { query } : {}),
    ...(typeof unreadOnly === 'boolean' ? { unreadOnly } : {}),
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

const unexpectedErrorResponse = (req: PayloadRequest, error: unknown, operation: string): Response => {
  req.payload.logger.error(
    {
      err: toLoggedError(error),
      event: `clinic_dashboard.inquiries.${operation}_failed`,
    },
    'Clinic Dashboard inquiry operation failed',
  )
  return inquiryErrorResponse(req, ERROR_DESCRIPTIONS.unavailable)
}

const sweepAttachments = async (req: PayloadRequest): Promise<void> => {
  try {
    await sweepExpiredAttachmentDrafts(req)
  } catch (error: unknown) {
    req.payload.logger.error(
      {
        err: toLoggedError(error),
        event: 'clinic_dashboard.inquiries.attachment_sweep_failed',
      },
      'Expired inquiry attachment sweep failed',
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
        {
          err: toLoggedError(error),
          event: 'clinic_dashboard.inquiries.moderation_reconciliation_failed',
        },
        'Expired inquiry moderation reconciliation failed',
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
        {
          err: toLoggedError(error),
          event: 'clinic_dashboard.inquiries.attachment_discard_cleanup_failed',
        },
        'Discarded inquiry attachment cleanup failed',
      )
    }

    await sweepAttachments(req)
  })
}

const execute = async <Value>(
  req: PayloadRequest,
  operation: string,
  command: () => Promise<Value>,
  success: (value: Value) => Response = (value) =>
    clinicDashboardPrivateJsonResponse(projectInquiryContractValue(req, value), 200),
): Promise<Response> => {
  try {
    return success(await command())
  } catch (error: unknown) {
    if (error instanceof InquiryCommunicationServiceError) {
      const description = ERROR_DESCRIPTIONS[error.kind as keyof typeof ERROR_DESCRIPTIONS]
      return inquiryErrorResponse(req, description ?? ERROR_DESCRIPTIONS.unavailable, error.current)
    }
    return unexpectedErrorResponse(req, error, operation)
  }
}

export const clinicDashboardInquiriesGetHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:view')
  if (!authorization.ok) return authorization.response
  const input = readQueueInput(req)
  if (input instanceof Response) return input
  return execute(req, 'queue_read', () => readClinicInquiryQueue(req, input))
}

export const clinicDashboardInquiryDetailGetHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:view')
  if (!authorization.ok) return authorization.response
  const input = readDetailInput(req)
  if (input instanceof Response) return input
  return execute(req, 'detail_read', async () => {
    const result = await readClinicInquiryDetail(req, input)
    scheduleModerationReconciliation(req, input.inquiryId)
    return result
  })
}

export const clinicDashboardInquiryMessagesPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, externalMessageInputSchema)
  if (input instanceof Response) return input
  return execute(req, 'message_send', () => sendClinicInquiryMessage(req, input))
}

export const clinicDashboardInquiryNotesPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, internalNoteInputSchema)
  if (input instanceof Response) return input
  return execute(req, 'note_add', () => addClinicInquiryNote(req, input))
}

export const clinicDashboardInquiryStatePatchHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, inquiryStateInputSchema)
  if (input instanceof Response) return input
  return execute(req, 'state_update', () => updateClinicInquiryState(req, input))
}

export const clinicDashboardInquiryReadPositionPutHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:view')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, inquiryReadPositionInputSchema)
  if (input instanceof Response) return input
  return execute(
    req,
    'read_position_update',
    () => updateClinicInquiryReadPosition(req, input),
    (value) => clinicDashboardPrivateJsonResponse({ unread: value.inquiry.unread }, 200),
  )
}

export const clinicDashboardInquiryContactRevealPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:view')
  if (!authorization.ok) return authorization.response
  const freshAuthentication = await requireFreshClinicAuthentication(req)
  if (!freshAuthentication.ok) return freshAuthentication.response
  const input = await readBody(req, inquiryContactRevealInputSchema)
  if (input instanceof Response) return input
  const previousReauthorization = req.context?.inquiryContactReauthorized
  req.context = { ...(req.context ?? {}), inquiryContactReauthorized: true }
  try {
    return await execute(req, 'contact_reveal', () => revealClinicInquiryContact(req, input))
  } finally {
    if (typeof previousReauthorization === 'undefined') {
      delete req.context?.inquiryContactReauthorized
    } else {
      req.context = { ...(req.context ?? {}), inquiryContactReauthorized: previousReauthorization }
    }
  }
}

export const clinicDashboardInquiryAttachmentDraftPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, attachmentDraftCreateInputSchema)
  if (input instanceof Response) return input
  return execute(
    req,
    'attachment_draft_create',
    () => createAttachmentDraft(req, input),
    (value) => {
      scheduleAttachmentSweep(req)
      return clinicDashboardPrivateJsonResponse(value, 201)
    },
  )
}

export const clinicDashboardInquiryAttachmentFinalizePostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, attachmentDraftMutationInputSchema)
  if (input instanceof Response) return input
  return execute(
    req,
    'attachment_draft_finalize',
    () => finalizeAttachmentDraft(req, input),
    () => {
      scheduleAttachmentSweep(req)
      return clinicDashboardPrivateJsonResponse({ finalized: true }, 200)
    },
  )
}

export const clinicDashboardInquiryAttachmentDiscardPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-inquiries:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, attachmentDraftMutationInputSchema)
  if (input instanceof Response) return input
  return execute(
    req,
    'attachment_draft_discard',
    () => discardAttachmentDraft(req, input),
    (value) => {
      scheduleDiscardCleanup(req, value.attachmentId)
      return clinicDashboardPrivateJsonResponse({ discarded: true }, 200)
    },
  )
}

const attachmentAccessHandler =
  (mode: 'download' | 'preview'): PayloadHandler =>
  async (req) => {
    const authorization = await authorizeClinic(req, 'clinic-inquiries:view')
    if (!authorization.ok) return authorization.response
    const attachmentId = readAttachmentId(req)
    if (attachmentId instanceof Response) return attachmentId
    return execute(
      req,
      `attachment_${mode}`,
      () =>
        proxyInquiryAttachment(req, {
          attachmentId,
          mode,
          responseHeaders: CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS,
        }),
      (response) => {
        scheduleAttachmentSweep(req)
        return response
      },
    )
  }

export const clinicDashboardInquiryAttachmentDownloadGetHandler = attachmentAccessHandler('download')
export const clinicDashboardInquiryAttachmentPreviewGetHandler = attachmentAccessHandler('preview')
