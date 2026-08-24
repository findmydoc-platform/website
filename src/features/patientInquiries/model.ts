import type {
  InquiryDetailDTO,
  InquiryUnreadDTO,
  PatientInquiryQueueDTO,
} from '@/features/inquiryCommunication/contracts'
import { INQUIRY_ATTACHMENT_MAX_BYTES, INQUIRY_ATTACHMENT_MIME_TYPES } from '@/features/inquiryCommunication/contracts'

export type PatientInquiryFilter = 'all' | 'open' | 'closed'
export type PatientInquirySendStatus = 'ambiguous' | 'error' | 'idle' | 'sending' | 'uploading'

export type PatientInquiryComposerState = {
  attachmentDraftId?: string
  error?: string
  file?: File
  fileError?: string
  idempotencyKey?: string
  retryReady?: boolean
  sendStatus: PatientInquirySendStatus
  text: string
}

type QueueState = {
  data?: PatientInquiryQueueDTO
  error?: string
  refreshError?: string
  status: 'error' | 'idle' | 'loading' | 'ready'
}

type DetailState = {
  changeCursor?: string
  data?: InquiryDetailDTO
  error?: string
  status: 'error' | 'idle' | 'loading' | 'ready'
}

export type PatientInquiriesState = {
  composer: PatientInquiryComposerState
  detail: DetailState
  filter: PatientInquiryFilter
  queue: QueueState
  selectedInquiryId?: string
  sessionEnded: boolean
}

export type PatientInquiriesAction =
  | { type: 'queue-loading' }
  | { queue: PatientInquiryQueueDTO; type: 'queue-loaded' }
  | { message: string; type: 'queue-failed' }
  | { filter: PatientInquiryFilter; type: 'filter-changed' }
  | { inquiryId: string; type: 'inquiry-selected' }
  | { type: 'inquiry-cleared' }
  | { type: 'detail-loading' }
  | { changeCursor: string; inquiry: InquiryDetailDTO; type: 'detail-loaded' }
  | { message: string; type: 'detail-failed' }
  | { message: string; type: 'detail-unavailable' }
  | { inquiryId: string; type: 'read-position-updated'; unread: InquiryUnreadDTO }
  | { text: string; type: 'composer-text-changed' }
  | { file?: File; fileError?: string; type: 'composer-file-changed' }
  | { idempotencyKey: string; type: 'send-started' }
  | { type: 'upload-started' }
  | { draftId: string; type: 'attachment-draft-ready' }
  | { draftId?: string; idempotencyKey: string; type: 'send-ambiguous' }
  | { message: string; resetIdentity?: boolean; retryReady?: boolean; type: 'send-failed' }
  | { inquiry: InquiryDetailDTO; message: string; type: 'send-conflict' }
  | { type: 'send-retry-started' }
  | { changeCursor?: string; inquiry: InquiryDetailDTO; type: 'send-succeeded' }
  | { type: 'composer-cleared' }
  | { type: 'session-ended' }

const createComposerState = (): PatientInquiryComposerState => ({ sendStatus: 'idle', text: '' })

export const createInitialPatientInquiriesState = (selectedInquiryId?: string): PatientInquiriesState => ({
  composer: createComposerState(),
  detail: { status: 'idle' },
  filter: 'all',
  queue: { status: 'idle' },
  ...(selectedInquiryId ? { selectedInquiryId } : {}),
  sessionEnded: false,
})

const resetRecovery = (composer: PatientInquiryComposerState): PatientInquiryComposerState => ({
  ...composer,
  error: undefined,
  idempotencyKey: undefined,
  sendStatus: 'idle',
})

export const patientInquiriesReducer = (
  state: PatientInquiriesState,
  action: PatientInquiriesAction,
): PatientInquiriesState => {
  switch (action.type) {
    case 'queue-loading':
      return state.queue.data
        ? { ...state, queue: { ...state.queue, refreshError: undefined } }
        : { ...state, queue: { status: 'loading' } }
    case 'queue-loaded':
      if (
        state.queue.status === 'ready' &&
        !state.queue.refreshError &&
        state.queue.data?.changeCursor === action.queue.changeCursor
      ) {
        return state
      }
      return { ...state, queue: { data: action.queue, status: 'ready' } }
    case 'queue-failed':
      return state.queue.data
        ? { ...state, queue: { ...state.queue, refreshError: action.message, status: 'ready' } }
        : { ...state, queue: { error: action.message, status: 'error' } }
    case 'filter-changed':
      return { ...state, filter: action.filter }
    case 'inquiry-selected':
      if (state.selectedInquiryId === action.inquiryId) return state
      return {
        ...state,
        composer: createComposerState(),
        detail: { status: 'idle' },
        selectedInquiryId: action.inquiryId,
      }
    case 'inquiry-cleared':
      return {
        ...state,
        composer: createComposerState(),
        detail: { status: 'idle' },
        selectedInquiryId: undefined,
      }
    case 'detail-loading':
      return state.detail.data ? state : { ...state, detail: { status: 'loading' } }
    case 'detail-loaded':
      if (
        state.detail.changeCursor === action.changeCursor &&
        state.detail.data &&
        action.inquiry.id === state.detail.data.id &&
        state.composer.sendStatus !== 'ambiguous'
      ) {
        return state
      }
      return {
        ...state,
        composer: state.composer.sendStatus === 'ambiguous' ? { ...state.composer, retryReady: true } : state.composer,
        detail: { changeCursor: action.changeCursor, data: action.inquiry, status: 'ready' },
        selectedInquiryId: action.inquiry.id,
      }
    case 'detail-failed':
      return state.detail.data
        ? { ...state, detail: { ...state.detail, error: action.message } }
        : { ...state, detail: { error: action.message, status: 'error' } }
    case 'detail-unavailable':
      return {
        ...state,
        composer: createComposerState(),
        detail: { error: action.message, status: 'error' },
      }
    case 'read-position-updated': {
      const queue = state.queue.data
      const previousUnread = queue?.items.find((entry) => entry.id === action.inquiryId)?.unread.isUnread ?? false
      const nextQueue = queue
        ? {
            ...queue,
            items: queue.items.map((entry) =>
              entry.id === action.inquiryId ? { ...entry, unread: action.unread } : entry,
            ),
            unreadCount:
              previousUnread && !action.unread.isUnread ? Math.max(0, queue.unreadCount - 1) : queue.unreadCount,
          }
        : undefined
      return {
        ...state,
        detail:
          state.detail.data?.id === action.inquiryId
            ? { ...state.detail, data: { ...state.detail.data, unread: action.unread } }
            : state.detail,
        queue: nextQueue ? { data: nextQueue, status: 'ready' } : state.queue,
      }
    }
    case 'composer-text-changed':
      return {
        ...state,
        composer: { ...resetRecovery(state.composer), text: action.text },
      }
    case 'composer-file-changed':
      return {
        ...state,
        composer: {
          ...resetRecovery(state.composer),
          attachmentDraftId: undefined,
          file: action.file,
          fileError: action.fileError,
        },
      }
    case 'send-started':
      return {
        ...state,
        composer: { ...state.composer, error: undefined, idempotencyKey: action.idempotencyKey, sendStatus: 'sending' },
      }
    case 'upload-started':
      return { ...state, composer: { ...state.composer, error: undefined, sendStatus: 'uploading' } }
    case 'attachment-draft-ready':
      return { ...state, composer: { ...state.composer, attachmentDraftId: action.draftId } }
    case 'send-ambiguous':
      return {
        ...state,
        composer: {
          ...state.composer,
          attachmentDraftId: action.draftId,
          error: 'We could not confirm whether your message was sent.',
          idempotencyKey: action.idempotencyKey,
          retryReady: false,
          sendStatus: 'ambiguous',
        },
      }
    case 'send-failed':
      return {
        ...state,
        composer: {
          ...state.composer,
          error: action.message,
          ...(action.resetIdentity ? { attachmentDraftId: undefined, idempotencyKey: undefined } : {}),
          retryReady: action.retryReady,
          sendStatus: 'error',
        },
      }
    case 'send-conflict':
      return {
        ...state,
        composer: { ...state.composer, error: action.message, sendStatus: 'error' },
        detail: { data: action.inquiry, status: 'ready' },
      }
    case 'send-retry-started':
      return state.composer.idempotencyKey && state.composer.retryReady
        ? { ...state, composer: { ...state.composer, error: undefined, sendStatus: 'sending' } }
        : state
    case 'send-succeeded': {
      const queue = state.queue.data
      const nextQueue = queue
        ? {
            ...queue,
            items: queue.items.map((entry) =>
              entry.id === action.inquiry.id
                ? {
                    ...entry,
                    lastActivityAt: action.inquiry.lastActivityAt,
                    lifecycle: action.inquiry.lifecycle,
                    preview: action.inquiry.preview,
                    revision: action.inquiry.revision,
                    unread: action.inquiry.unread,
                  }
                : entry,
            ),
          }
        : undefined
      return {
        ...state,
        composer: createComposerState(),
        detail: {
          changeCursor: action.changeCursor ?? state.detail.changeCursor,
          data: action.inquiry,
          status: 'ready',
        },
        queue: nextQueue ? { data: nextQueue, status: 'ready' } : state.queue,
      }
    }
    case 'composer-cleared':
      return { ...state, composer: createComposerState() }
    case 'session-ended':
      return { ...createInitialPatientInquiriesState(), sessionEnded: true }
  }
}

export const validatePatientInquiryFile = (file: File): string | null =>
  INQUIRY_ATTACHMENT_MIME_TYPES.includes(file.type as (typeof INQUIRY_ATTACHMENT_MIME_TYPES)[number]) &&
  file.size > 0 &&
  file.size <= INQUIRY_ATTACHMENT_MAX_BYTES
    ? null
    : 'Choose a PNG, JPEG, WebP or PDF file up to 5 MB.'
