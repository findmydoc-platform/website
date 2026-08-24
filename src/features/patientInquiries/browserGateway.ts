import type {
  AttachmentDraftCreateInput,
  AttachmentDraftDTO,
  AttachmentDraftMutationInput,
  ExternalMessageInput,
  InquiryCommunicationErrorCode,
  InquiryDetailDTO,
  InquiryDetailInput,
  InquiryDetailResultDTO,
  InquiryMutationResultDTO,
  InquiryReadPositionInput,
  InquiryUnreadDTO,
  PatientInquiryQueueDTO,
  PatientInquiryQueueInput,
} from '@/features/inquiryCommunication/contracts'

type ApiErrorBody = {
  error?: {
    code?: unknown
    current?: unknown
  }
}

type UploadDraftInput = {
  file: File
  upload: AttachmentDraftDTO['upload']
}

const SERVICE_UNAVAILABLE_CODE: InquiryCommunicationErrorCode = 'INQUIRY_SERVICE_UNAVAILABLE'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isErrorCode = (value: unknown): value is InquiryCommunicationErrorCode =>
  typeof value === 'string' && value.startsWith('INQUIRY_')

const isQueue = (value: unknown): value is PatientInquiryQueueDTO =>
  isRecord(value) &&
  typeof value.changeCursor === 'string' &&
  isRecord(value.counts) &&
  Array.isArray(value.items) &&
  typeof value.unreadCount === 'number'

const isDetailResult = (value: unknown): value is InquiryDetailResultDTO =>
  isRecord(value) &&
  typeof value.changeCursor === 'string' &&
  isRecord(value.inquiry) &&
  typeof value.unchanged === 'boolean'

const isMutationResult = (value: unknown): value is InquiryMutationResultDTO =>
  isRecord(value) && isRecord(value.inquiry)

const isDraft = (value: unknown): value is AttachmentDraftDTO =>
  isRecord(value) && typeof value.draftId === 'string' && isRecord(value.upload) && typeof value.upload.url === 'string'

const isUnreadResult = (value: unknown): value is { unread: InquiryUnreadDTO } =>
  isRecord(value) && isRecord(value.unread) && typeof value.unread.isUnread === 'boolean'

const isBooleanResult =
  <Key extends string>(key: Key) =>
  (value: unknown): value is Record<Key, true> =>
    isRecord(value) && value[key] === true

const safeJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export class PatientInquiriesApiError extends Error {
  ambiguous: boolean
  code: InquiryCommunicationErrorCode
  current?: InquiryDetailDTO
  status: number

  constructor({
    ambiguous = false,
    code,
    current,
    status,
  }: {
    ambiguous?: boolean
    code: InquiryCommunicationErrorCode
    current?: InquiryDetailDTO
    status: number
  }) {
    super(code)
    this.name = 'PatientInquiriesApiError'
    this.ambiguous = ambiguous
    this.code = code
    this.current = current
    this.status = status
  }
}

const responseError = async (response: Response): Promise<PatientInquiriesApiError> => {
  const body = (await safeJson(response)) as ApiErrorBody | undefined
  const code = isErrorCode(body?.error?.code) ? body.error.code : SERVICE_UNAVAILABLE_CODE
  const current = isRecord(body?.error?.current) ? (body.error.current as InquiryDetailDTO) : undefined
  return new PatientInquiriesApiError({ code, current, status: response.status })
}

const requestJson = async <Value>(
  path: string,
  init: RequestInit,
  validate: (value: unknown) => value is Value,
  ambiguousOnNetworkFailure = false,
): Promise<Value> => {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new PatientInquiriesApiError({
      ambiguous: ambiguousOnNetworkFailure,
      code: SERVICE_UNAVAILABLE_CODE,
      status: 0,
    })
  }

  if (!response.ok) throw await responseError(response)
  const value = await safeJson(response)
  if (!validate(value)) {
    throw new PatientInquiriesApiError({ code: SERVICE_UNAVAILABLE_CODE, status: response.status })
  }
  return value
}

const sameOriginJsonInit = (method: 'POST' | 'PUT', body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  cache: 'no-store',
  credentials: 'same-origin',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  method,
})

export type PatientInquiriesApi = {
  attachmentDownloadHref: (attachmentId: string) => string
  createDraft: (input: AttachmentDraftCreateInput) => Promise<AttachmentDraftDTO>
  discardDraft: (input: AttachmentDraftMutationInput) => Promise<{ discarded: true }>
  finalizeDraft: (input: AttachmentDraftMutationInput) => Promise<{ finalized: true }>
  readDetail: (input: InquiryDetailInput) => Promise<InquiryDetailResultDTO>
  readQueue: (input?: PatientInquiryQueueInput) => Promise<PatientInquiryQueueDTO>
  sendMessage: (input: ExternalMessageInput) => Promise<InquiryMutationResultDTO>
  updateReadPosition: (input: InquiryReadPositionInput) => Promise<{ unread: InquiryUnreadDTO }>
  uploadDraft: (input: UploadDraftInput) => Promise<void>
}

export const createPatientInquiriesBrowserApi = (): PatientInquiriesApi => ({
  attachmentDownloadHref: (attachmentId) =>
    `/api/patient/inquiries/attachments/download?attachmentId=${encodeURIComponent(attachmentId)}`,

  createDraft: (input) =>
    requestJson('/api/patient/inquiries/attachments/drafts', sameOriginJsonInit('POST', input), isDraft, true),

  discardDraft: (input) =>
    requestJson(
      '/api/patient/inquiries/attachments/drafts/discard',
      sameOriginJsonInit('POST', input),
      isBooleanResult('discarded'),
      true,
    ),

  finalizeDraft: (input) =>
    requestJson(
      '/api/patient/inquiries/attachments/drafts/finalize',
      sameOriginJsonInit('POST', input),
      isBooleanResult('finalized'),
      true,
    ),

  readDetail: (input) => {
    const query = new URLSearchParams({ inquiryId: input.inquiryId })
    if (input.knownChangeCursor) query.set('knownChangeCursor', input.knownChangeCursor)
    if (typeof input.knownRevision === 'number') query.set('knownRevision', String(input.knownRevision))
    return requestJson(
      `/api/patient/inquiries/detail?${query.toString()}`,
      { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' }, method: 'GET' },
      isDetailResult,
    )
  },

  readQueue: (input = {}) => {
    const query = new URLSearchParams()
    if (input.cursor) query.set('cursor', input.cursor)
    query.set('lifecycle', input.lifecycle ?? 'all')
    query.set('limit', String(input.limit ?? 25))
    return requestJson(
      `/api/patient/inquiries?${query.toString()}`,
      { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' }, method: 'GET' },
      isQueue,
    )
  },

  sendMessage: (input) =>
    requestJson('/api/patient/inquiries/messages', sameOriginJsonInit('POST', input), isMutationResult, true),

  updateReadPosition: (input) =>
    requestJson('/api/patient/inquiries/read-position', sameOriginJsonInit('PUT', input), isUnreadResult, true),

  uploadDraft: async ({ file, upload }) => {
    let response: Response
    try {
      response = await fetch(upload.url, {
        body: file,
        credentials: 'omit',
        headers: upload.headers,
        method: upload.method,
        redirect: 'error',
      })
    } catch {
      throw new PatientInquiriesApiError({ ambiguous: true, code: SERVICE_UNAVAILABLE_CODE, status: 0 })
    }
    if (!response.ok) throw new PatientInquiriesApiError({ code: SERVICE_UNAVAILABLE_CODE, status: response.status })
  },
})
