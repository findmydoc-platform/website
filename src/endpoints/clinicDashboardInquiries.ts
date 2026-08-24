import { after } from 'next/server.js'
import type { PayloadHandler, PayloadRequest } from 'payload'
import type { ZodType } from 'zod'

import { extractTokenFromHeader, validateSupabaseFreshFirstFactor } from '@/auth/utilities/jwtValidation'
import type { ClinicDashboardCapability } from '@/features/clinicDashboard/bootstrap'
import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'
import { resolveClinicDashboardContract } from '@/features/clinicDashboard/contractNegotiation'
import {
  attachmentDraftCreateInputSchema,
  attachmentDraftMutationInputSchema,
  clinicInquiryQueueInputSchema,
  externalMessageInputSchema,
  INQUIRY_ATTACHMENT_MAX_BYTES,
  INQUIRY_ATTACHMENT_MIME_TYPES,
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
  readAttachmentAccess,
  readClinicInquiryDetail,
  readClinicInquiryQueue,
  revealClinicInquiryContact,
  sendClinicInquiryMessage,
  sweepExpiredAttachmentDrafts,
  updateClinicInquiryReadPosition,
  updateClinicInquiryState,
} from '@/features/inquiryCommunication/service'
import { resolveS3StorageConfig } from '@/plugins/storageConfig'
import { toLoggedError } from '@/utilities/logging/shared'
import { CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS, clinicDashboardPrivateJsonResponse } from './clinicDashboardBootstrap'

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

const inquiryErrorResponse = (
  description: ErrorDescription,
  current?: InquiryCommunicationServiceError['current'],
): Response =>
  clinicDashboardPrivateJsonResponse(
    {
      error: {
        code: description.code,
        ...(current ? { current } : {}),
      },
    },
    description.status,
  )

const authorizeClinic = async (
  req: PayloadRequest,
  capability: ClinicDashboardCapability,
): Promise<AuthorizationResult> => {
  if (resolveClinicDashboardContract(req.headers) !== 'inquiry') {
    return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS['invalid-input']) }
  }
  const result = await revalidateClinicDashboardRequest(req, 'inquiry')

  switch (result.status) {
    case 'authorized': {
      return result.data.capabilities.includes(capability)
        ? { ok: true }
        : { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS['access-denied']) }
    }
    case 'access-denied':
      return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS['access-denied']) }
    case 'unavailable':
      return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS.unavailable) }
    case 'unauthorized':
      return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS.unauthorized) }
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
    return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS.unauthorized) }
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
      return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS.unauthorized) }
    case 'reauthentication-required':
      return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS['reauthentication-required']) }
    case 'unavailable':
      return { ok: false, response: inquiryErrorResponse(ERROR_DESCRIPTIONS.unavailable) }
  }
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

const serviceErrorResponse = (error: InquiryCommunicationServiceError): Response => {
  const description = ERROR_DESCRIPTIONS[error.kind as keyof typeof ERROR_DESCRIPTIONS]
  return inquiryErrorResponse(description ?? ERROR_DESCRIPTIONS.unavailable, error.current)
}

const unexpectedErrorResponse = (req: PayloadRequest, error: unknown, operation: string): Response => {
  req.payload.logger.error(
    {
      err: toLoggedError(error),
      event: `clinic_dashboard.inquiries.${operation}_failed`,
    },
    'Clinic Dashboard inquiry operation failed',
  )
  return inquiryErrorResponse(ERROR_DESCRIPTIONS.unavailable)
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
  success: (value: Value) => Response = (value) => clinicDashboardPrivateJsonResponse(value, 200),
): Promise<Response> => {
  try {
    return success(await command())
  } catch (error: unknown) {
    if (error instanceof InquiryCommunicationServiceError) return serviceErrorResponse(error)
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
  return execute(req, 'detail_read', () => readClinicInquiryDetail(req, input))
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

const safeStorageUrl = (rawUrl: string): URL | null => {
  let url: URL
  let endpoint: URL
  let storage: ReturnType<typeof resolveS3StorageConfig>
  try {
    url = new URL(rawUrl)
    storage = resolveS3StorageConfig(process.env)
    endpoint = new URL(storage.clientConfig.endpoint)
  } catch {
    return null
  }

  if (url.username || url.password || url.origin !== endpoint.origin) return null
  const basePath = endpoint.pathname.replace(/\/$/u, '')
  const bucketPath = `${basePath}/${encodeURIComponent(storage.bucket)}/`.replace(/^\/\//u, '/')
  return url.pathname.startsWith(bucketPath) ? url : null
}

const safeAttachmentDisposition = (mode: 'download' | 'preview', value: string | null): string | null => {
  if (!value || /[\u0000-\u001f\u007f]/u.test(value)) return null
  const expected = mode === 'download' ? 'attachment;' : 'inline;'
  return value.toLocaleLowerCase('en').startsWith(expected) ? value : null
}

const readBoundedAttachmentBytes = async (storedResponse: Response, expectedLength?: number): Promise<ArrayBuffer> => {
  const reader = storedResponse.body?.getReader()
  if (!reader) throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage returned no content.')

  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (!chunk.value) continue
      byteLength += chunk.value.byteLength
      if (byteLength > INQUIRY_ATTACHMENT_MAX_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new InquiryCommunicationServiceError('payload-too-large', 'The attachment is too large.')
      }
      chunks.push(chunk.value)
    }
  } catch (error: unknown) {
    if (error instanceof InquiryCommunicationServiceError) throw error
    throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage is unavailable.')
  }

  if (byteLength <= 0 || (typeof expectedLength === 'number' && byteLength !== expectedLength)) {
    throw new InquiryCommunicationServiceError('payload-too-large', 'The attachment size is invalid.')
  }

  const buffer = new ArrayBuffer(byteLength)
  const bytes = new Uint8Array(buffer)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return buffer
}

const proxyAttachment = async (
  req: PayloadRequest,
  attachmentId: string,
  mode: 'download' | 'preview',
): Promise<Response> => {
  const access = await readAttachmentAccess(req, { attachmentId, mode })
  const storageUrl = safeStorageUrl(access.url)
  if (!storageUrl) throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage access is invalid.')

  let storedResponse: Response
  try {
    storedResponse = await fetch(storageUrl, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    })
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new InquiryCommunicationServiceError('service-timeout', 'Attachment storage timed out.')
    }
    throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage is unavailable.')
  }

  if (!storedResponse.ok) {
    throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage is unavailable.')
  }

  const rawContentType = storedResponse.headers.get('content-type')?.split(';', 1)[0]?.trim()
  if (!rawContentType || !INQUIRY_ATTACHMENT_MIME_TYPES.includes(rawContentType as never)) {
    throw new InquiryCommunicationServiceError('unsupported-media-type', 'The attachment type is unavailable.')
  }
  const declaredLength = storedResponse.headers.get('content-length')
  const expectedLength = declaredLength === null ? undefined : parseInteger(declaredLength)
  if (
    expectedLength === null ||
    (typeof expectedLength === 'number' && expectedLength > INQUIRY_ATTACHMENT_MAX_BYTES)
  ) {
    throw new InquiryCommunicationServiceError('payload-too-large', 'The attachment is too large.')
  }

  const disposition = safeAttachmentDisposition(
    mode,
    storedResponse.headers.get('content-disposition') ?? storageUrl.searchParams.get('response-content-disposition'),
  )
  if (!disposition) {
    throw new InquiryCommunicationServiceError('unavailable', 'Attachment response metadata is unavailable.')
  }

  const bytes = await readBoundedAttachmentBytes(storedResponse, expectedLength)

  return new Response(bytes, {
    status: 200,
    headers: {
      ...CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS,
      'Content-Disposition': disposition,
      'Content-Length': String(bytes.byteLength),
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Content-Type': rawContentType,
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  })
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
      () => proxyAttachment(req, attachmentId, mode),
      (response) => {
        scheduleAttachmentSweep(req)
        return response
      },
    )
  }

export const clinicDashboardInquiryAttachmentDownloadGetHandler = attachmentAccessHandler('download')
export const clinicDashboardInquiryAttachmentPreviewGetHandler = attachmentAccessHandler('preview')
