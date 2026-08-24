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
  id: 'message:1',
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
  appeal: vi.fn().mockResolvedValue({ submitted: true }),
  attachmentDownloadHref: (attachmentId) => `/download/${attachmentId}`,
  createDraft: vi.fn(),
  discardDraft: vi.fn().mockResolvedValue({ discarded: true }),
  finalizeDraft: vi.fn(),
  readDetail: vi.fn().mockResolvedValue({ changeCursor: 'detail-1', inquiry: detail, unchanged: false }),
  readQueue: vi.fn().mockResolvedValue(queue),
  report: vi.fn().mockResolvedValue({ received: true, reportId: 'case-1' }),
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

  it('marks an explicit deep link read once and never repeats the write during polling', async () => {
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
    expect(api.updateReadPosition).toHaveBeenCalledTimes(1)
    expect(api.updateReadPosition).toHaveBeenCalledWith({
      activityId: 'message:1',
      inquiryId: 'inquiry-1',
      mode: 'read',
    })
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

  it('treats the filter as part of the queue snapshot identity', async () => {
    const closedItem = { ...item, id: 'inquiry-closed', lifecycle: 'closed' as const, preview: 'Closed inquiry.' }
    const readQueue = vi
      .fn()
      .mockResolvedValueOnce(queue)
      .mockResolvedValueOnce({
        ...queue,
        changeCursor: queue.changeCursor,
        counts: { all: 2, closed: 1, open: 1 },
        items: [closedItem],
      })
    const api = createApi({ readQueue })

    render(<PatientInquiriesController api={api} loginHref="/login" mode="index" />)
    await screen.findByText('Would Tuesday work?')
    fireEvent.click(screen.getByRole('button', { name: /Closed/u }))

    expect(await screen.findByText('Closed inquiry.')).toBeTruthy()
    expect(screen.queryByText('Would Tuesday work?')).toBeNull()
    expect(readQueue).toHaveBeenLastCalledWith({ lifecycle: 'closed', limit: 25 })
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
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Your session has ended' }))
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

  it('submits a conversation report with a stable browser idempotency key and shows confirmation', async () => {
    const report = vi.fn().mockResolvedValue({ received: true, reportId: 'case-1' })
    const api = createApi({ report })

    render(
      <PatientInquiriesController
        api={api}
        initialInquiryId="inquiry-1"
        loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-1"
        mode="detail"
      />,
    )

    await screen.findAllByText('Would Tuesday work?')
    fireEvent.click(screen.getByRole('button', { name: 'Report conversation' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Reason' }), {
      target: { value: 'privacy-concern' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Additional details' }), {
      target: { value: 'Synthetic wrong-recipient report.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(report).toHaveBeenCalledTimes(1))
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'privacy-concern',
        description: 'Synthetic wrong-recipient report.',
        idempotencyKey: expect.stringMatching(/\S{8,}/u),
        inquiryId: 'inquiry-1',
        targetId: 'conversation-1',
        targetType: 'conversation',
      }),
    )
    expect(await screen.findByText('Report received')).toBeTruthy()
  })

  it('reuses a failed report key only while the report content is unchanged', async () => {
    const report = vi.fn().mockRejectedValue(new Error('synthetic report failure'))
    const api = createApi({ report })

    render(
      <PatientInquiriesController
        api={api}
        initialInquiryId="inquiry-1"
        loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-1"
        mode="detail"
      />,
    )

    await screen.findAllByText('Would Tuesday work?')
    fireEvent.click(screen.getByRole('button', { name: 'Report conversation' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Reason' }), {
      target: { value: 'privacy-concern' },
    })
    const details = screen.getByRole('textbox', { name: 'Additional details' })
    fireEvent.change(details, { target: { value: 'Synthetic retry report.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    await waitFor(() => expect(report).toHaveBeenCalledTimes(1))
    const firstKey = report.mock.calls[0]?.[0].idempotencyKey

    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    await waitFor(() => expect(report).toHaveBeenCalledTimes(2))
    expect(report.mock.calls[1]?.[0].idempotencyKey).toBe(firstKey)

    fireEvent.change(details, { target: { value: 'Synthetic edited retry report.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    await waitFor(() => expect(report).toHaveBeenCalledTimes(3))
    expect(report.mock.calls[2]?.[0].idempotencyKey).not.toBe(firstKey)
  })

  it('submits the one available appeal and refreshes the server projection', async () => {
    const restrictedDetail: InquiryDetailDTO = {
      ...detail,
      actions: { ...detail.actions, canReply: false },
      binding: { ...detail.binding, canReply: false },
      moderation: {
        conversation: {
          appeal: { caseId: 'case-1', state: 'available' },
          category: 'privacy-concern',
          isCurrentActorAffected: true,
          state: 'restricted',
        },
        identity: { state: 'available' },
      },
    }
    const appeal = vi.fn().mockResolvedValue({ submitted: true })
    const readDetail = vi.fn().mockResolvedValue({
      changeCursor: 'detail-restricted',
      inquiry: restrictedDetail,
      unchanged: false,
    })
    const api = createApi({ appeal, readDetail })

    render(
      <PatientInquiriesController
        api={api}
        initialInquiryId="inquiry-1"
        loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-1"
        mode="detail"
      />,
    )

    await screen.findByText('Messaging in this conversation is restricted')
    fireEvent.click(screen.getByRole('button', { name: 'Appeal decision' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Appeal' }), {
      target: { value: 'Synthetic appeal for review.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit appeal' }))

    await waitFor(() => expect(appeal).toHaveBeenCalledWith({ caseId: 'case-1', text: 'Synthetic appeal for review.' }))
    expect(readDetail.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(await screen.findByText('Appeal submitted')).toBeTruthy()
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

  it('uses a real inquiry link and waits for the detail route before marking it read', async () => {
    const api = createApi()

    render(<PatientInquiriesController api={api} loginHref="/login/patient?next=%2Fpatient%2Finquiries" mode="index" />)

    const inquiryLink = await screen.findByRole('link', { name: /Izmir Coast Dental/u })
    expect(api.updateReadPosition).not.toHaveBeenCalled()
    expect(inquiryLink.getAttribute('href')).toBe('/patient/inquiries/inquiry-1')
  })

  it('does not write a patient read position without a visible clinic message', async () => {
    const api = createApi({
      readDetail: vi.fn().mockResolvedValue({
        changeCursor: 'detail-patient-only',
        inquiry: {
          ...detail,
          timeline: [{ ...clinicReply, actor: { ...clinicReply.actor, isCurrentActor: true, kind: 'patient' } }],
        },
        unchanged: false,
      }),
    })

    render(
      <PatientInquiriesController
        api={api}
        initialInquiryId="inquiry-1"
        loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-1"
        mode="detail"
      />,
    )

    await screen.findAllByText('Would Tuesday work?')
    expect(api.updateReadPosition).not.toHaveBeenCalled()
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
    const uploadDraft = vi.fn(async ({ onProgress }) => {
      operations.push('upload')
      onProgress?.(50)
      onProgress?.(100)
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
    expect((fileInput as HTMLInputElement).value).toBe('')
  })

  it('loads older inquiries through the queue cursor and appends them', async () => {
    const olderItem = { ...item, id: 'inquiry-2', preview: 'Older synthetic inquiry.' }
    const readQueue = vi
      .fn()
      .mockResolvedValueOnce({ ...queue, nextCursor: 'page-2' })
      .mockResolvedValueOnce({ ...queue, changeCursor: 'queue-2', items: [olderItem], nextCursor: undefined })
    const api = createApi({ readQueue })

    render(<PatientInquiriesController api={api} loginHref="/login" mode="index" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Load more inquiries' }))
    expect(await screen.findByText('Older synthetic inquiry.')).toBeTruthy()
    expect(readQueue).toHaveBeenLastCalledWith({ cursor: 'page-2', lifecycle: 'all', limit: 25 })
    expect(
      screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href')?.startsWith('/patient/inquiries/inquiry-')),
    ).toHaveLength(2)
  })

  it('keeps attachment removal disabled while the upload is in flight', async () => {
    const upload = deferred<void>()
    const api = createApi({
      createDraft: vi.fn().mockResolvedValue({
        draftId: 'draft-1',
        expiresAt: '2026-08-25T12:00:00.000Z',
        upload: { headers: {}, method: 'PUT', url: 'https://storage.test' },
      }),
      uploadDraft: vi.fn(() => upload.promise),
    })
    const { container } = render(
      <PatientInquiriesController api={api} initialInquiryId="inquiry-1" loginHref="/login" mode="detail" />,
    )
    await screen.findAllByText('Would Tuesday work?')
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['scan'], 'scan.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    const remove = await screen.findByRole('button', { name: 'Remove attachment' })
    await waitFor(() => expect((remove as HTMLButtonElement).disabled).toBe(true))
    expect(screen.getByRole('progressbar', { name: 'Attachment upload progress' })).toBeTruthy()
    upload.resolve()
  })
})
