// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  InquiryDetailDTO,
  InquiryListItemDTO,
  InquiryTimelineItemDTO,
  PatientInquiryQueueDTO,
} from '@/features/inquiryCommunication/contracts'
import { PatientInquiriesApiError, type PatientInquiriesApi } from '@/features/patientInquiries/browserGateway'
import { PatientInquiriesController } from '@/features/patientInquiries/PatientInquiriesController.client'

const item: InquiryListItemDTO = {
  binding: {
    canReply: true,
    conversationId: 'conversation-1',
    kind: 'patient',
    patient: { displayName: 'Synthetic Patient', id: 'patient-1' },
  },
  clinic: { displayName: 'Izmir Coast Dental', id: 'clinic-1' },
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
}

const clinicReply: Extract<InquiryTimelineItemDTO, { kind: 'external-message' }> = {
  actor: { displayName: 'Izmir Coast Dental', isCurrentActor: false, kind: 'clinic' },
  createdAt: '2026-08-24T10:06:00.000Z',
  id: 'message-1',
  kind: 'external-message',
  text: 'Would Tuesday work?',
}

const detail: InquiryDetailDTO = {
  ...item,
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
  timeline: [clinicReply],
}

const queue: PatientInquiryQueueDTO = {
  changeCursor: 'queue-1',
  counts: { all: 1, closed: 0, open: 1 },
  items: [item],
  unchanged: false,
  unreadCount: 1,
}

const createApi = (overrides: Partial<PatientInquiriesApi> = {}): PatientInquiriesApi => ({
  attachmentDownloadHref: (attachmentId) => `/download/${attachmentId}`,
  createDraft: vi.fn(),
  discardDraft: vi.fn().mockResolvedValue({ discarded: true }),
  finalizeDraft: vi.fn(),
  readDetail: vi.fn().mockResolvedValue({ changeCursor: 'detail-1', inquiry: detail, unchanged: false }),
  readQueue: vi.fn().mockResolvedValue(queue),
  sendMessage: vi.fn().mockResolvedValue({ inquiry: detail }),
  updateReadPosition: vi.fn().mockResolvedValue({ unread: { count: 0, isUnread: false } }),
  uploadDraft: vi.fn(),
  ...overrides,
})

const deferred = <Value,>() => {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('PatientInquiriesController', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  afterEach(() => {
    cleanup()
  })

  it('loads and polls private data without ever marking the inquiry read automatically', async () => {
    const api = createApi()

    render(
      <PatientInquiriesController
        api={api}
        initialInquiryId="inquiry-1"
        loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-1"
        mode="detail"
        pollIntervalMs={20}
      />,
    )

    await screen.findAllByText('Would Tuesday work?')
    await waitFor(() => expect(vi.mocked(api.readQueue).mock.calls.length).toBeGreaterThanOrEqual(2))

    expect(vi.mocked(api.readDetail).mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(api.updateReadPosition).not.toHaveBeenCalled()
  })

  it('does not let a late queue poll overwrite a newer queue snapshot', async () => {
    const firstQueue = deferred<PatientInquiryQueueDTO>()
    const newerItem = { ...item, clinic: { displayName: 'Newer Synthetic Clinic', id: 'clinic-2' } }
    const readQueue = vi
      .fn()
      .mockImplementationOnce(() => firstQueue.promise)
      .mockResolvedValue({ ...queue, changeCursor: 'queue-2', items: [newerItem] })
    const api = createApi({ readQueue })

    render(
      <PatientInquiriesController
        api={api}
        loginHref="/login/patient?next=%2Fpatient%2Finquiries"
        mode="index"
        pollIntervalMs={20}
      />,
    )

    expect(await screen.findByText('Newer Synthetic Clinic')).toBeTruthy()
    firstQueue.resolve(queue)
    await waitFor(() => expect(readQueue.mock.calls.length).toBeGreaterThanOrEqual(2))

    expect(screen.queryByText('Izmir Coast Dental')).toBeNull()
    expect(screen.getByText('Newer Synthetic Clinic')).toBeTruthy()
  })

  it('does not let a late detail poll overwrite a newer conversation snapshot', async () => {
    const firstDetail =
      deferred<ReturnType<PatientInquiriesApi['readDetail']> extends Promise<infer Value> ? Value : never>()
    const newerDetail = {
      ...detail,
      timeline: [{ ...clinicReply, id: 'message-2', text: 'Newer synthetic reply.' }],
    }
    const readDetail = vi
      .fn()
      .mockImplementationOnce(() => firstDetail.promise)
      .mockResolvedValue({ changeCursor: 'detail-2', inquiry: newerDetail, unchanged: false })
    const api = createApi({ readDetail })

    render(
      <PatientInquiriesController
        api={api}
        initialInquiryId="inquiry-1"
        loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-1"
        mode="detail"
        pollIntervalMs={20}
      />,
    )

    expect(await screen.findByText('Newer synthetic reply.')).toBeTruthy()
    firstDetail.resolve({
      changeCursor: 'detail-1',
      inquiry: {
        ...detail,
        timeline: [{ ...clinicReply, id: 'message-old', text: 'Older synthetic reply.' }],
      },
      unchanged: false,
    })
    await waitFor(() => expect(readDetail.mock.calls.length).toBeGreaterThanOrEqual(2))

    expect(screen.queryByText('Older synthetic reply.')).toBeNull()
    expect(screen.getByText('Newer synthetic reply.')).toBeTruthy()
  })

  it('purges private state and shows the exact login return target after session loss', async () => {
    const api = createApi({
      readQueue: vi.fn().mockRejectedValue(new PatientInquiriesApiError({ code: 'INQUIRY_UNAUTHORIZED', status: 401 })),
    })

    render(<PatientInquiriesController api={api} loginHref="/login/patient?next=%2Fpatient%2Finquiries" mode="index" />)

    expect(await screen.findByRole('heading', { name: 'Your session has ended' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe(
      '/login/patient?next=%2Fpatient%2Finquiries',
    )
    expect(screen.queryByText('Izmir Coast Dental')).toBeNull()
  })

  it('does not expose the composer when the server denies reply permission', async () => {
    const replyDeniedDetail = {
      ...detail,
      actions: { ...detail.actions, canReply: false },
    }
    const sendMessage = vi.fn()
    const api = createApi({
      readDetail: vi
        .fn()
        .mockResolvedValue({ changeCursor: 'detail-denied', inquiry: replyDeniedDetail, unchanged: false }),
      sendMessage,
    })

    render(
      <PatientInquiriesController
        api={api}
        initialInquiryId="inquiry-1"
        loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-1"
        mode="detail"
      />,
    )

    expect(await screen.findByText('Replies are unavailable for this inquiry.')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('refreshes first after an ambiguous send and retries only explicitly with the same key', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(
        new PatientInquiriesApiError({
          ambiguous: true,
          code: 'INQUIRY_SERVICE_UNAVAILABLE',
          status: 0,
        }),
      )
      .mockResolvedValueOnce({ inquiry: { ...detail, revision: 3 } })
    const readDetail = vi
      .fn()
      .mockResolvedValueOnce({ changeCursor: 'detail-1', inquiry: detail, unchanged: false })
      .mockResolvedValueOnce({ changeCursor: 'detail-2', inquiry: detail, unchanged: false })
    const api = createApi({ readDetail, sendMessage })

    render(
      <PatientInquiriesController
        api={api}
        initialInquiryId="inquiry-1"
        loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-1"
        mode="detail"
      />,
    )

    await screen.findAllByText('Would Tuesday work?')
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Tuesday works.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(readDetail).toHaveBeenCalledTimes(2))
    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect((retry as HTMLButtonElement).disabled).toBe(false)
    expect(sendMessage).toHaveBeenCalledTimes(1)

    fireEvent.click(retry)
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2))

    const firstKey = sendMessage.mock.calls[0]?.[0].idempotencyKey
    expect(sendMessage.mock.calls[1]?.[0].idempotencyKey).toBe(firstKey)
    expect(firstKey).toMatch(/\S{8,}/u)
  })

  it('marks an unread inquiry read only after the patient explicitly selects it', async () => {
    const api = createApi()

    render(<PatientInquiriesController api={api} loginHref="/login/patient?next=%2Fpatient%2Finquiries" mode="index" />)

    const inquiryButton = await screen.findByRole('button', { name: /Izmir Coast Dental/u })
    expect(api.updateReadPosition).not.toHaveBeenCalled()
    fireEvent.click(inquiryButton)

    await waitFor(() => expect(api.updateReadPosition).toHaveBeenCalledWith({ inquiryId: 'inquiry-1', mode: 'read' }))
  })

  it('reserves, uploads, finalizes, and binds one attachment before confirming the message', async () => {
    const operations: string[] = []
    const createDraft = vi.fn(async () => {
      operations.push('create')
      return {
        draftId: 'draft-1',
        expiresAt: '2026-08-25T12:00:00.000Z',
        upload: { headers: { 'Content-Type': 'application/pdf' }, method: 'PUT' as const, url: 'https://storage.test' },
      }
    })
    const uploadDraft = vi.fn(async () => {
      operations.push('upload')
    })
    const finalizeDraft = vi.fn(async () => {
      operations.push('finalize')
      return { finalized: true as const }
    })
    const sendMessage = vi.fn(async () => {
      operations.push('send')
      return { inquiry: { ...detail, revision: 3 } }
    })
    const api = createApi({ createDraft, finalizeDraft, sendMessage, uploadDraft })
    const { container } = render(
      <PatientInquiriesController
        api={api}
        initialInquiryId="inquiry-1"
        loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-1"
        mode="detail"
      />,
    )

    await screen.findAllByText('Would Tuesday work?')
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).not.toBeNull()
    const file = new File(['synthetic report'], 'report.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Attached report.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(operations).toEqual(['create', 'upload', 'finalize', 'send'])
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentDraftId: 'draft-1', inquiryId: 'inquiry-1', text: 'Attached report.' }),
    )
  })
})
