'use client'

import * as React from 'react'

import { PatientInquiriesPage } from '@/components/templates/PatientInquiriesPage/Component'
import type { InquiryDetailDTO, PatientInquiryQueueInput } from '@/features/inquiryCommunication/contracts'

import { PatientInquiriesApiError, createPatientInquiriesBrowserApi, type PatientInquiriesApi } from './browserGateway'
import {
  createInitialPatientInquiriesState,
  patientInquiriesReducer,
  validatePatientInquiryFile,
  type PatientInquiryFilter,
} from './model'
import type { PatientInquiryDetailView } from './viewModel'

type PatientInquiriesControllerProps = {
  api?: PatientInquiriesApi
  initialInquiryId?: string
  loginHref: string
  mode: 'detail' | 'index'
  pollIntervalMs?: number
}

const isSessionError = (error: unknown): error is PatientInquiriesApiError =>
  error instanceof PatientInquiriesApiError &&
  (error.code === 'INQUIRY_UNAUTHORIZED' ||
    error.code === 'INQUIRY_REAUTHENTICATION_REQUIRED' ||
    error.code === 'INQUIRY_ACCESS_DENIED')

const messageForError = (error: unknown, fallback: string): string => {
  if (!(error instanceof PatientInquiriesApiError)) return fallback
  if (error.code === 'INQUIRY_NOT_FOUND') return 'This inquiry is no longer available.'
  if (error.code === 'INQUIRY_ACCESS_DENIED') return 'This inquiry is no longer available.'
  if (error.code === 'INQUIRY_INVALID_STATE') return 'The inquiry changed. Refresh and try again.'
  if (error.code === 'INQUIRY_RATE_LIMITED') return 'Too many attempts. Wait a moment and try again.'
  if (error.code === 'INQUIRY_PAYLOAD_TOO_LARGE' || error.code === 'INQUIRY_UNSUPPORTED_MEDIA_TYPE') {
    return 'Choose a PNG, JPEG, WebP or PDF file up to 5 MB.'
  }
  return fallback
}

const createMessageKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `message-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const replacePath = (path: string): void => {
  if (typeof window === 'undefined') return
  window.history.pushState(null, '', path)
}

export function PatientInquiriesController({
  api: providedApi,
  initialInquiryId,
  loginHref,
  mode,
  pollIntervalMs = 15_000,
}: PatientInquiriesControllerProps) {
  const api = React.useMemo(() => providedApi ?? createPatientInquiriesBrowserApi(), [providedApi])
  const [state, dispatch] = React.useReducer(
    patientInquiriesReducer,
    initialInquiryId,
    createInitialPatientInquiriesState,
  )
  const stateRef = React.useRef(state)
  const detailRequestIdRef = React.useRef(0)
  const queueRequestIdRef = React.useRef(0)
  stateRef.current = state

  const endSession = React.useCallback(() => {
    detailRequestIdRef.current += 1
    queueRequestIdRef.current += 1
    dispatch({ type: 'session-ended' })
  }, [])

  const loadQueue = React.useCallback(
    async (filterOverride?: PatientInquiryFilter): Promise<boolean> => {
      const current = stateRef.current
      const requestId = ++queueRequestIdRef.current
      dispatch({ type: 'queue-loading' })
      try {
        const filter = filterOverride ?? current.filter
        const input: PatientInquiryQueueInput = { lifecycle: filter, limit: 25 }
        const queue = await api.readQueue(input)
        if (requestId !== queueRequestIdRef.current) return true
        dispatch({ queue, type: 'queue-loaded' })
        return true
      } catch (error: unknown) {
        if (isSessionError(error)) {
          endSession()
          return false
        }
        if (requestId !== queueRequestIdRef.current) return false
        dispatch({ message: messageForError(error, 'Check your connection and try again.'), type: 'queue-failed' })
        return false
      }
    },
    [api, endSession],
  )

  const loadDetail = React.useCallback(
    async (inquiryId: string): Promise<boolean> => {
      const current = stateRef.current
      const requestId = ++detailRequestIdRef.current
      const currentDetail = current.detail.data?.id === inquiryId ? current.detail : undefined
      if (!currentDetail?.data) dispatch({ type: 'detail-loading' })
      try {
        const result = await api.readDetail({
          inquiryId,
          ...(currentDetail?.changeCursor ? { knownChangeCursor: currentDetail.changeCursor } : {}),
          ...(typeof currentDetail?.data?.revision === 'number' ? { knownRevision: currentDetail.data.revision } : {}),
        })
        if (requestId !== detailRequestIdRef.current) return true
        dispatch({ changeCursor: result.changeCursor, inquiry: result.inquiry, type: 'detail-loaded' })
        return true
      } catch (error: unknown) {
        if (isSessionError(error)) {
          endSession()
          return false
        }
        if (requestId !== detailRequestIdRef.current) return false
        if (error instanceof PatientInquiriesApiError && error.code === 'INQUIRY_NOT_FOUND') {
          dispatch({ message: 'This inquiry is no longer available.', type: 'detail-unavailable' })
          return false
        }
        dispatch({ message: messageForError(error, 'Check your connection and try again.'), type: 'detail-failed' })
        return false
      }
    },
    [api, endSession],
  )

  React.useEffect(() => {
    void loadQueue()
    if (initialInquiryId) void loadDetail(initialInquiryId)
  }, [initialInquiryId, loadDetail, loadQueue])

  React.useEffect(() => {
    if (state.sessionEnded) return
    const refreshVisibleData = () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) return
      void loadQueue()
      const inquiryId = stateRef.current.selectedInquiryId
      if (inquiryId) void loadDetail(inquiryId)
    }
    const interval = window.setInterval(refreshVisibleData, pollIntervalMs)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshVisibleData()
    }
    window.addEventListener('focus', refreshVisibleData)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshVisibleData)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadDetail, loadQueue, pollIntervalMs, state.sessionEnded])

  const detailView = React.useMemo<PatientInquiryDetailView | undefined>(() => {
    if (!state.detail.data) return undefined
    return {
      ...state.detail.data,
      timeline: state.detail.data.timeline.map((item) => ({
        ...item,
        ...(item.kind === 'external-message' && item.attachment
          ? { attachmentDownloadHref: api.attachmentDownloadHref(item.attachment.id) }
          : {}),
      })),
    }
  }, [api, state.detail.data])

  const selectInquiry = React.useCallback(
    (inquiryId: string) => {
      dispatch({ inquiryId, type: 'inquiry-selected' })
      replacePath(`/patient/inquiries/${encodeURIComponent(inquiryId)}`)
      void (async () => {
        const loaded = await loadDetail(inquiryId)
        if (!loaded) return
        try {
          const result = await api.updateReadPosition({ inquiryId, mode: 'read' })
          dispatch({ inquiryId, type: 'read-position-updated', unread: result.unread })
        } catch (error: unknown) {
          if (isSessionError(error)) endSession()
        }
      })()
    },
    [api, endSession, loadDetail],
  )

  const goBack = React.useCallback(() => {
    const inquiryId = stateRef.current.selectedInquiryId
    detailRequestIdRef.current += 1
    dispatch({ type: 'inquiry-cleared' })
    replacePath('/patient/inquiries')
    if (inquiryId) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-inquiry-id="${CSS.escape(inquiryId)}"]`)?.focus()
      })
    }
  }, [])

  const selectFilter = React.useCallback(
    (filter: PatientInquiryFilter) => {
      dispatch({ filter, type: 'filter-changed' })
      void loadQueue(filter)
    },
    [loadQueue],
  )

  const selectFile = React.useCallback(
    (file?: File) => {
      const current = stateRef.current
      const oldDraftId = current.composer.attachmentDraftId
      if (oldDraftId && current.selectedInquiryId) {
        void api.discardDraft({ draftId: oldDraftId, inquiryId: current.selectedInquiryId }).catch(() => undefined)
      }
      dispatch({
        file,
        fileError: file ? (validatePatientInquiryFile(file) ?? undefined) : undefined,
        type: 'composer-file-changed',
      })
    },
    [api],
  )

  const send = React.useCallback(
    async (retry: boolean): Promise<void> => {
      const current = stateRef.current
      const inquiry = current.detail.data
      const inquiryId = current.selectedInquiryId
      if (!inquiry || !inquiryId || inquiry.lifecycle !== 'open' || !inquiry.actions.canReply) return
      const text = current.composer.text
      if (!text.trim() && !current.composer.file) return

      const idempotencyKey = current.composer.idempotencyKey ?? createMessageKey()
      let draftId = current.composer.attachmentDraftId
      let messageAttempted = false

      if (retry) {
        if (!current.composer.retryReady || !current.composer.idempotencyKey) return
        dispatch({ type: 'send-retry-started' })
      } else {
        dispatch({ idempotencyKey, type: 'send-started' })
      }

      try {
        if (!retry && current.composer.file && !draftId) {
          dispatch({ type: 'upload-started' })
          const draft = await api.createDraft({
            fileName: current.composer.file.name,
            inquiryId,
            mimeType: current.composer.file
              .type as InquiryDetailDTO['attachmentConstraints']['acceptedMimeTypes'][number],
            sizeBytes: current.composer.file.size,
          })
          draftId = draft.draftId
          try {
            await api.uploadDraft({ file: current.composer.file, upload: draft.upload })
            await api.finalizeDraft({ draftId, inquiryId })
          } catch (error: unknown) {
            void api.discardDraft({ draftId, inquiryId }).catch(() => undefined)
            throw error
          }
          dispatch({ draftId, type: 'attachment-draft-ready' })
        }

        messageAttempted = true
        const result = await api.sendMessage({
          ...(draftId ? { attachmentDraftId: draftId } : {}),
          expectedRevision: inquiry.revision,
          idempotencyKey,
          inquiryId,
          ...(text ? { text } : {}),
        })
        dispatch({ inquiry: result.inquiry, type: 'send-succeeded' })
        void loadQueue()
      } catch (error: unknown) {
        if (isSessionError(error)) {
          endSession()
          return
        }
        if (error instanceof PatientInquiriesApiError && error.code === 'INQUIRY_CONFLICT' && error.current) {
          dispatch({
            inquiry: error.current,
            message: 'The inquiry changed while you were replying.',
            type: 'send-conflict',
          })
          return
        }
        if (messageAttempted && error instanceof PatientInquiriesApiError && error.ambiguous) {
          dispatch({ draftId, idempotencyKey, type: 'send-ambiguous' })
          await loadDetail(inquiryId)
          return
        }
        dispatch({
          message: messageForError(error, 'Your message was not sent. Try again.'),
          resetIdentity: !messageAttempted,
          retryReady: messageAttempted,
          type: 'send-failed',
        })
      }
    },
    [api, endSession, loadDetail, loadQueue],
  )

  const clearFailedMessage = React.useCallback(() => {
    const current = stateRef.current
    if (current.composer.attachmentDraftId && current.selectedInquiryId) {
      void api
        .discardDraft({ draftId: current.composer.attachmentDraftId, inquiryId: current.selectedInquiryId })
        .catch(() => undefined)
    }
    dispatch({ type: 'composer-cleared' })
  }, [api])

  const resolvedMode = state.selectedInquiryId ? 'detail' : mode

  return (
    <PatientInquiriesPage
      actions={{
        clearFailedMessage,
        goBack,
        retryDetail: () => {
          const inquiryId = stateRef.current.selectedInquiryId
          if (inquiryId) void loadDetail(inquiryId)
        },
        retryQueue: () => void loadQueue(),
        retrySend: () => {
          const composer = stateRef.current.composer
          void send(Boolean(composer.idempotencyKey && composer.retryReady))
        },
        selectFile,
        selectFilter,
        selectInquiry,
        sendMessage: () => void send(false),
        updateMessage: (text) => dispatch({ text, type: 'composer-text-changed' }),
      }}
      detailView={detailView}
      loginHref={loginHref}
      mode={resolvedMode}
      state={state}
    />
  )
}
