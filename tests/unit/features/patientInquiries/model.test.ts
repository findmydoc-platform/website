import { describe, expect, it } from 'vitest'

import type {
  InquiryDetailDTO,
  InquiryListItemDTO,
  PatientInquiryQueueDTO,
} from '@/features/inquiryCommunication/contracts'
import {
  createInitialPatientInquiriesState,
  patientInquiriesReducer,
  validatePatientInquiryFile,
} from '@/features/patientInquiries/model'

const item = (overrides: Partial<InquiryListItemDTO> = {}): InquiryListItemDTO => ({
  binding: {
    canReply: true,
    conversationId: 'conversation-1',
    kind: 'patient',
    patient: { displayName: 'Synthetic Patient', id: 'patient-1' },
  },
  clinic: { displayName: 'Izmir Coast Dental', id: 'clinic-1', messagingAvailable: true },
  createdAt: '2026-08-24T08:00:00.000Z',
  handlingStatus: 'in_review',
  id: 'inquiry-1',
  interest: { label: 'Dental implants' },
  latestActivityKind: 'external-message',
  lastActivityAt: '2026-08-24T10:06:00.000Z',
  lifecycle: 'open',
  patientName: 'Synthetic Patient',
  preview: 'Would Tuesday work?',
  revision: 2,
  unread: { count: 1, isUnread: true },
  ...overrides,
})

const detail = (overrides: Partial<InquiryDetailDTO> = {}): InquiryDetailDTO => ({
  ...item(),
  actions: {
    canAddInternalNote: false,
    canChangeHandlingStatus: false,
    canChangeLifecycle: false,
    canMarkRead: true,
    canMarkUnread: false,
    canReply: true,
    canRevealContact: false,
    canView: true,
  },
  attachmentConstraints: {
    acceptedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    maxFileBytes: 5 * 1024 * 1024,
    maxFilesPerMessage: 1,
  },
  contact: { mode: 'collapsed' },
  originalRequest: { message: 'I would like a treatment plan.' },
  timeline: [],
  ...overrides,
})

const queue = (overrides: Partial<PatientInquiryQueueDTO> = {}): PatientInquiryQueueDTO => ({
  changeCursor: 'queue-1',
  counts: { all: 1, closed: 0, open: 1 },
  items: [item()],
  unchanged: false,
  unreadCount: 1,
  ...overrides,
})

describe('patient inquiries model', () => {
  it('never reuses a queue snapshot across different filter scopes', () => {
    const ready = patientInquiriesReducer(createInitialPatientInquiriesState(), {
      queue: queue({ changeCursor: 'shared-cursor' }),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-loaded',
    })

    const filtering = patientInquiriesReducer(ready, { filter: 'closed', type: 'filter-changed' })
    expect(filtering.queue.data).toBeUndefined()
    expect(filtering.queue.status).toBe('loading')

    const closed = patientInquiriesReducer(filtering, {
      queue: queue({
        changeCursor: 'shared-cursor',
        counts: { all: 1, closed: 1, open: 0 },
        items: [item({ id: 'inquiry-closed', lifecycle: 'closed' })],
      }),
      scope: { filter: 'closed', limit: 25 },
      type: 'queue-loaded',
    })

    expect(closed.queue.data?.items).toHaveLength(1)
    expect(closed.queue.data?.items[0]?.lifecycle).toBe('closed')
  })

  it('appends a cursor page without duplicating inquiries', () => {
    const ready = patientInquiriesReducer(createInitialPatientInquiriesState(), {
      queue: queue({ nextCursor: 'page-2' }),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-loaded',
    })
    const loadingMore = patientInquiriesReducer(ready, {
      scope: { filter: 'all', limit: 25 },
      type: 'queue-load-more-started',
    })
    const appended = patientInquiriesReducer(loadingMore, {
      queue: queue({
        changeCursor: 'queue-2',
        items: [item(), item({ id: 'inquiry-2', preview: 'Older inquiry' })],
        nextCursor: undefined,
      }),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-page-loaded',
    })

    expect(appended.queue.data?.items.map((entry) => entry.id)).toEqual(['inquiry-1', 'inquiry-2'])
    expect(appended.queue.loadingMore).toBe(false)
    expect(appended.queue.data?.nextCursor).toBeUndefined()
  })

  it('skips visible queue churn when a refetch returns the same change cursor', () => {
    const ready = patientInquiriesReducer(createInitialPatientInquiriesState(), {
      queue: queue(),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-loaded',
    })
    const unchanged = patientInquiriesReducer(ready, {
      queue: queue({ items: [item({ preview: 'stale duplicate response' })] }),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-loaded',
    })

    expect(unchanged).toBe(ready)
    expect(unchanged.queue.data?.items[0]?.preview).toBe('Would Tuesday work?')
  })

  it('retains loaded data when a background refresh fails', () => {
    const ready = patientInquiriesReducer(createInitialPatientInquiriesState(), {
      queue: queue(),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-loaded',
    })
    const failed = patientInquiriesReducer(ready, { message: 'Refresh failed.', type: 'queue-failed' })

    expect(failed.queue.data).toBe(ready.queue.data)
    expect(failed.queue.status).toBe('ready')
    expect(failed.queue.refreshError).toBe('Refresh failed.')
  })

  it('replaces queue data and clears refresh errors when the change cursor advances', () => {
    let state = patientInquiriesReducer(createInitialPatientInquiriesState(), {
      queue: queue(),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-loaded',
    })
    state = patientInquiriesReducer(state, { message: 'Refresh failed.', type: 'queue-failed' })

    const refreshed = patientInquiriesReducer(state, {
      queue: queue({ changeCursor: 'queue-2', items: [item({ preview: 'New clinic reply' })] }),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-loaded',
    })

    expect(refreshed.queue.data?.items[0]?.preview).toBe('New clinic reply')
    expect(refreshed.queue.refreshError).toBeUndefined()
  })

  it('purges queue, detail, files, and drafts when the patient session ends', () => {
    let state = patientInquiriesReducer(createInitialPatientInquiriesState('inquiry-1'), {
      queue: queue(),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-loaded',
    })
    state = patientInquiriesReducer(state, {
      changeCursor: 'detail-1',
      inquiry: detail(),
      type: 'detail-loaded',
    })
    state = patientInquiriesReducer(state, { text: 'Private draft', type: 'composer-text-changed' })
    state = patientInquiriesReducer(state, {
      draftId: 'draft-1',
      idempotencyKey: 'message-key-1234',
      type: 'send-ambiguous',
    })

    const ended = patientInquiriesReducer(state, { type: 'session-ended' })

    expect(ended.sessionEnded).toBe(true)
    expect(ended.queue.data).toBeUndefined()
    expect(ended.detail.data).toBeUndefined()
    expect(ended.composer).toEqual(createInitialPatientInquiriesState().composer)
  })

  it('keeps the same idempotency key for an explicit retry after refresh-first recovery', () => {
    let state = patientInquiriesReducer(createInitialPatientInquiriesState('inquiry-1'), {
      text: 'Tuesday works.',
      type: 'composer-text-changed',
    })
    state = patientInquiriesReducer(state, {
      idempotencyKey: 'message-key-1234',
      type: 'send-started',
    })
    state = patientInquiriesReducer(state, {
      draftId: undefined,
      idempotencyKey: 'message-key-1234',
      type: 'send-ambiguous',
    })
    const blocked = patientInquiriesReducer(state, { type: 'send-retry-started' })
    expect(blocked).toBe(state)

    state = patientInquiriesReducer(state, {
      changeCursor: 'detail-2',
      inquiry: detail({ revision: 3 }),
      type: 'detail-loaded',
    })
    state = patientInquiriesReducer(state, { type: 'send-retry-started' })

    expect(state.composer.idempotencyKey).toBe('message-key-1234')
    expect(state.composer.sendStatus).toBe('sending')
  })

  it('invalidates recovery identity when the failed message content changes', () => {
    let state = patientInquiriesReducer(createInitialPatientInquiriesState('inquiry-1'), {
      idempotencyKey: 'message-key-1234',
      type: 'send-started',
    })
    state = patientInquiriesReducer(state, {
      draftId: 'draft-1',
      idempotencyKey: 'message-key-1234',
      type: 'send-ambiguous',
    })

    const changed = patientInquiriesReducer(state, {
      text: 'A different message',
      type: 'composer-text-changed',
    })

    expect(changed.composer.idempotencyKey).toBeUndefined()
    expect(changed.composer.sendStatus).toBe('idle')
    expect(changed.composer.attachmentDraftId).toBe('draft-1')
  })

  it('applies a safe conflict snapshot without deleting the patient draft', () => {
    let state = patientInquiriesReducer(createInitialPatientInquiriesState('inquiry-1'), {
      text: 'Please keep this draft.',
      type: 'composer-text-changed',
    })
    state = patientInquiriesReducer(state, {
      idempotencyKey: 'message-key-1234',
      type: 'send-started',
    })

    const conflicted = patientInquiriesReducer(state, {
      inquiry: detail({ lifecycle: 'closed', revision: 4 }),
      message: 'The inquiry changed while you were replying.',
      type: 'send-conflict',
    })

    expect(conflicted.detail.data?.lifecycle).toBe('closed')
    expect(conflicted.composer.text).toBe('Please keep this draft.')
    expect(conflicted.composer.sendStatus).toBe('error')
  })

  it('preserves the draft when a closed inquiry is reopened by refresh', () => {
    let state = patientInquiriesReducer(createInitialPatientInquiriesState('inquiry-1'), {
      changeCursor: 'detail-closed',
      inquiry: detail({ lifecycle: 'closed' }),
      type: 'detail-loaded',
    })
    state = patientInquiriesReducer(state, { text: 'Saved while closed', type: 'composer-text-changed' })

    const reopened = patientInquiriesReducer(state, {
      changeCursor: 'detail-open',
      inquiry: detail({ lifecycle: 'open', revision: 4 }),
      type: 'detail-loaded',
    })

    expect(reopened.detail.data?.lifecycle).toBe('open')
    expect(reopened.composer.text).toBe('Saved while closed')
  })

  it('updates personal unread state only after an explicit read-position result', () => {
    const ready = patientInquiriesReducer(createInitialPatientInquiriesState('inquiry-1'), {
      queue: queue(),
      scope: { filter: 'all', limit: 25 },
      type: 'queue-loaded',
    })
    const read = patientInquiriesReducer(ready, {
      inquiryId: 'inquiry-1',
      type: 'read-position-updated',
      unread: { count: 0, isUnread: false },
    })

    expect(read.queue.data?.items[0]?.unread.isUnread).toBe(false)
    expect(read.queue.data?.unreadCount).toBe(0)
  })

  it('validates the one-file attachment contract locally', () => {
    const valid = new File(['scan'], 'scan.pdf', { type: 'application/pdf' })
    const invalidType = new File(['archive'], 'scan.zip', { type: 'application/zip' })
    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.pdf', {
      type: 'application/pdf',
    })

    expect(validatePatientInquiryFile(valid)).toBeNull()
    expect(validatePatientInquiryFile(invalidType)).toBe('Choose a PNG, JPEG, WebP or PDF file up to 5 MB.')
    expect(validatePatientInquiryFile(tooLarge)).toBe('Choose a PNG, JPEG, WebP or PDF file up to 5 MB.')
  })
})
