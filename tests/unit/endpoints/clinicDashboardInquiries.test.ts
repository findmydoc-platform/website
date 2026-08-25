import type { PayloadRequest } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CLINIC_INQUIRY_CONTACT_REAUTH_MAX_AGE_SECONDS,
  clinicDashboardInquiriesGetHandler,
  clinicDashboardInquiryAttachmentDiscardPostHandler,
  clinicDashboardInquiryAttachmentDownloadGetHandler,
  clinicDashboardInquiryAttachmentDraftPostHandler,
  clinicDashboardInquiryAttachmentFinalizePostHandler,
  clinicDashboardInquiryAttachmentPreviewGetHandler,
  clinicDashboardInquiryContactRevealPostHandler,
  clinicDashboardInquiryDetailGetHandler,
  clinicDashboardInquiryMessagesPostHandler,
  clinicDashboardInquiryNotesPostHandler,
  clinicDashboardInquiryReadPositionPutHandler,
  clinicDashboardInquiryStatePatchHandler,
} from '@/endpoints/clinicDashboardInquiries'
import { InquiryCommunicationServiceError } from '@/features/inquiryCommunication/service'

const mocks = vi.hoisted(() => ({
  addNote: vi.fn(),
  after: vi.fn(),
  bearer: vi.fn(),
  bootstrap: vi.fn(),
  cleanup: vi.fn(),
  createDraft: vi.fn(),
  discardDraft: vi.fn(),
  finalizeDraft: vi.fn(),
  freshAuthentication: vi.fn(),
  readAttachmentAccess: vi.fn(),
  readDetail: vi.fn(),
  readQueue: vi.fn(),
  revealContact: vi.fn(),
  sendMessage: vi.fn(),
  sweep: vi.fn(),
  updateReadPosition: vi.fn(),
  updateState: vi.fn(),
}))

vi.mock('next/server.js', () => ({
  after: mocks.after,
}))

vi.mock('@/auth/utilities/jwtValidation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/auth/utilities/jwtValidation')>()),
  validateSupabaseBearerToken: mocks.bearer,
  validateSupabaseFreshFirstFactor: mocks.freshAuthentication,
}))

vi.mock('@/features/clinicDashboard/bootstrap', () => ({
  resolveClinicDashboardBootstrap: mocks.bootstrap,
}))

vi.mock('@/features/inquiryCommunication/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/inquiryCommunication/service')>()),
  addClinicInquiryNote: mocks.addNote,
  cleanupDiscardedAttachment: mocks.cleanup,
  createAttachmentDraft: mocks.createDraft,
  discardAttachmentDraft: mocks.discardDraft,
  finalizeAttachmentDraft: mocks.finalizeDraft,
  readAttachmentAccess: mocks.readAttachmentAccess,
  readClinicInquiryDetail: mocks.readDetail,
  readClinicInquiryQueue: mocks.readQueue,
  revealClinicInquiryContact: mocks.revealContact,
  sendClinicInquiryMessage: mocks.sendMessage,
  sweepExpiredAttachmentDrafts: mocks.sweep,
  updateClinicInquiryReadPosition: mocks.updateReadPosition,
  updateClinicInquiryState: mocks.updateState,
}))

vi.mock('@/plugins/storageConfig', () => ({
  resolveS3StorageConfig: () => ({
    bucket: 'findmydoc-test',
    clientConfig: { endpoint: 'https://storage.example.com' },
  }),
}))

const inquiry = {
  id: 'inquiry-1',
  revision: 4,
  unread: { count: 2, isUnread: true, lastReadActivityId: 'message:1' },
}

const successfulBootstrap = {
  status: 'success' as const,
  data: {
    capabilities: ['clinic-inquiries:view', 'clinic-inquiries:edit'],
    clinic: { id: 'clinic-1', name: 'Synthetic Clinic' },
    principal: { id: 'staff-1' },
    status: 'approved' as const,
  },
}

const request = ({
  body,
  contract = 'inquiry-communication-v2',
  search = '',
  subject = 'supabase-staff-1',
}: {
  body?: unknown
  contract?: 'inquiry-communication-v1' | 'inquiry-communication-v2'
  search?: string
  subject?: string
} = {}): PayloadRequest =>
  ({
    context: {},
    headers: new Headers({
      authorization: 'Bearer clinic-token',
      'X-Findmydoc-Clinic-Dashboard-Contract': contract,
    }),
    json: vi.fn(async () => body),
    payload: {
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        info: vi.fn(),
        level: 'info',
        trace: vi.fn(),
        warn: vi.fn(),
      },
    },
    searchParams: new URLSearchParams(search),
    user: {
      id: 'staff-1',
      collection: 'clinicStaff',
      supabaseUserId: subject,
    },
  }) as unknown as PayloadRequest

const json = async (response: Response) => ({ body: await response.json(), status: response.status })

const expectPrivateLive = (response: Response): void => {
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
  expect(response.headers.get('expires')).toBe('0')
  expect(response.headers.get('vary')).toBe('Authorization, X-Findmydoc-Clinic-Dashboard-Contract')
}

describe('Clinic Dashboard inquiry endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.after.mockImplementation((task: () => Promise<unknown> | unknown) => {
      void task()
    })
    mocks.bearer.mockResolvedValue({
      status: 'authenticated',
      authData: {
        supabaseUserId: 'supabase-staff-1',
        userEmail: 'staff@example.invalid',
        userType: 'clinic',
      },
    })
    mocks.freshAuthentication.mockResolvedValue({ status: 'authenticated' })
    mocks.bootstrap.mockResolvedValue(successfulBootstrap)
    mocks.readQueue.mockResolvedValue({ changeCursor: 'change-1', items: [], unchanged: false, unreadCount: 0 })
    mocks.readDetail.mockResolvedValue({ changeCursor: 'change-1', inquiry, unchanged: false })
    mocks.sendMessage.mockResolvedValue({ inquiry, replayed: false })
    mocks.addNote.mockResolvedValue({ inquiry, replayed: false })
    mocks.updateState.mockResolvedValue({ inquiry })
    mocks.updateReadPosition.mockResolvedValue({ inquiry })
    mocks.revealContact.mockResolvedValue({
      contact: { email: 'masked@example.invalid', mode: 'full', phoneNumber: '+49 000 0000' },
      inquiryId: inquiry.id,
    })
    mocks.createDraft.mockResolvedValue({
      draftId: 'draft-1',
      expiresAt: '2026-08-24T12:15:00.000Z',
      upload: {
        headers: { 'content-type': 'application/pdf' },
        method: 'PUT',
        url: 'https://storage.example.com/findmydoc-test/draft/signed',
      },
    })
    mocks.finalizeDraft.mockResolvedValue({
      attachment: { fileName: 'report.pdf', id: 'attachment-1', mimeType: 'application/pdf', sizeBytes: 4 },
    })
    mocks.discardDraft.mockResolvedValue({ attachmentId: 'attachment-1', discarded: true })
    mocks.sweep.mockResolvedValue({ cleaned: 0, examined: 0 })
  })

  it.each([
    ['missing', undefined],
    ['unknown', 'future-contract'],
    ['coalesced duplicate', 'inquiry-communication-v2, inquiry-communication-v2'],
  ])('fails closed before authentication when the contract header is %s', async (_case, value) => {
    const req = request()
    const headers = new Headers({ authorization: 'Bearer clinic-token' })
    if (value) headers.set('X-Findmydoc-Clinic-Dashboard-Contract', value)
    req.headers = headers

    const response = await clinicDashboardInquiriesGetHandler(req)

    expect(await json(response)).toEqual({
      status: 400,
      body: { error: { code: 'INQUIRY_INVALID_INPUT' } },
    })
    expect(mocks.bearer).not.toHaveBeenCalled()
    expect(mocks.bootstrap).not.toHaveBeenCalled()
    expect(mocks.readQueue).not.toHaveBeenCalled()
    expectPrivateLive(response)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses the bounded queue contract and never accepts client tenant scope', async () => {
    const req = request({
      search:
        'lifecycle=all&handlingStatus=submitted%2Cin_review&knownChangeCursor=change-0&limit=20&unreadOnly=true&query=synthetic',
    })
    const response = await clinicDashboardInquiriesGetHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.readQueue).toHaveBeenCalledWith(req, {
      handlingStatus: ['submitted', 'in_review'],
      knownChangeCursor: 'change-0',
      lifecycle: 'all',
      limit: 20,
      query: 'synthetic',
      unreadOnly: true,
    })
    expectPrivateLive(response)

    const expanded = await clinicDashboardInquiriesGetHandler(request({ search: 'clinicId=other-clinic' }))
    expect(await json(expanded)).toEqual({
      status: 400,
      body: { error: { code: 'INQUIRY_INVALID_INPUT' } },
    })
    expect(mocks.readQueue).toHaveBeenCalledOnce()
  })

  it('returns the same safe not-found result for missing and foreign tenant inquiries', async () => {
    mocks.readDetail.mockRejectedValue(new InquiryCommunicationServiceError('not-found', 'private detail'))

    const missing = await clinicDashboardInquiryDetailGetHandler(request({ search: 'inquiryId=missing' }))
    const foreign = await clinicDashboardInquiryDetailGetHandler(request({ search: 'inquiryId=foreign' }))

    expect(await json(missing)).toEqual({ status: 404, body: { error: { code: 'INQUIRY_NOT_FOUND' } } })
    expect(await json(foreign)).toEqual({ status: 404, body: { error: { code: 'INQUIRY_NOT_FOUND' } } })
  })

  it('forwards the opaque detail marker without trusting the legacy revision as an unchanged signal', async () => {
    const req = request({
      search: `inquiryId=${inquiry.id}&knownChangeCursor=detail-change-1&knownRevision=${inquiry.revision}`,
    })

    const response = await clinicDashboardInquiryDetailGetHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.readDetail).toHaveBeenCalledWith(req, {
      inquiryId: inquiry.id,
      knownChangeCursor: 'detail-change-1',
      knownRevision: inquiry.revision,
    })
  })

  it('keeps the v1 detail projection free of v2-only system events', async () => {
    mocks.readDetail.mockResolvedValueOnce({
      changeCursor: 'detail-change-2',
      inquiry: {
        ...inquiry,
        timeline: [
          { id: 'event-closed', kind: 'system-event', event: 'closed' },
          { id: 'event-restricted', kind: 'system-event', event: 'moderation-restricted' },
        ],
      },
      unchanged: false,
    })

    const response = await clinicDashboardInquiryDetailGetHandler(
      request({ contract: 'inquiry-communication-v1', search: `inquiryId=${inquiry.id}` }),
    )

    await expect(response.json()).resolves.toMatchObject({
      inquiry: { timeline: [{ event: 'closed', id: 'event-closed', kind: 'system-event' }] },
    })
  })

  it('requires a valid explicit Bearer token even when a cookie principal is present', async () => {
    mocks.bearer.mockResolvedValueOnce({ status: 'invalid' })

    const response = await clinicDashboardInquiriesGetHandler(request())

    expect(await json(response)).toEqual({ status: 401, body: { error: { code: 'INQUIRY_UNAUTHORIZED' } } })
    expect(mocks.bootstrap).not.toHaveBeenCalled()
    expect(mocks.readQueue).not.toHaveBeenCalled()
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('rejects a valid Bearer subject that differs from the resolved clinic principal', async () => {
    const response = await clinicDashboardInquiriesGetHandler(request({ subject: 'other-supabase-user' }))

    expect(await json(response)).toEqual({ status: 401, body: { error: { code: 'INQUIRY_UNAUTHORIZED' } } })
    expect(mocks.readQueue).not.toHaveBeenCalled()
  })

  it('checks current capabilities on every request and does not call mutations after revocation', async () => {
    mocks.bootstrap.mockResolvedValueOnce({
      ...successfulBootstrap,
      data: { ...successfulBootstrap.data, capabilities: ['clinic-inquiries:view'] },
    })

    const response = await clinicDashboardInquiryMessagesPostHandler(
      request({
        body: {
          expectedRevision: 4,
          idempotencyKey: 'message-key-1',
          inquiryId: inquiry.id,
          text: 'Synthetic reply',
        },
      }),
    )

    expect(await json(response)).toEqual({ status: 403, body: { error: { code: 'INQUIRY_ACCESS_DENIED' } } })
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  it('rejects caller-controlled actor, clinic, and patient fields before invoking the service', async () => {
    const response = await clinicDashboardInquiryMessagesPostHandler(
      request({
        body: {
          actorId: 'staff-2',
          clinicId: 'clinic-2',
          patientId: 'patient-2',
          expectedRevision: 4,
          idempotencyKey: 'message-key-1',
          inquiryId: inquiry.id,
          text: 'Synthetic reply',
        },
      }),
    )

    expect(await json(response)).toEqual({ status: 400, body: { error: { code: 'INQUIRY_INVALID_INPUT' } } })
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  it('projects a read-position write to the focused unread DTO only', async () => {
    const req = request({ body: { inquiryId: inquiry.id, mode: 'read' } })
    const response = await clinicDashboardInquiryReadPositionPutHandler(req)

    expect(await json(response)).toEqual({ status: 200, body: { unread: inquiry.unread } })
    expect(mocks.updateReadPosition).toHaveBeenCalledWith(req, { inquiryId: inquiry.id, mode: 'read' })
  })

  it('maps conflicts, timeouts, and rate limits to the stable error union', async () => {
    mocks.readDetail
      .mockRejectedValueOnce(new InquiryCommunicationServiceError('conflict', 'changed', inquiry as never))
      .mockRejectedValueOnce(new InquiryCommunicationServiceError('service-timeout', 'timed out'))
      .mockRejectedValueOnce(new InquiryCommunicationServiceError('rate-limited', 'slow down'))

    const conflict = await clinicDashboardInquiryDetailGetHandler(request({ search: `inquiryId=${inquiry.id}` }))
    const timeout = await clinicDashboardInquiryDetailGetHandler(request({ search: `inquiryId=${inquiry.id}` }))
    const rateLimited = await clinicDashboardInquiryDetailGetHandler(request({ search: `inquiryId=${inquiry.id}` }))

    expect(await json(conflict)).toEqual({
      status: 409,
      body: { error: { code: 'INQUIRY_CONFLICT', current: inquiry } },
    })
    expect(await json(timeout)).toEqual({ status: 504, body: { error: { code: 'INQUIRY_SERVICE_TIMEOUT' } } })
    expect(await json(rateLimited)).toEqual({ status: 429, body: { error: { code: 'INQUIRY_RATE_LIMITED' } } })
  })

  it('requires recent timestamped first-factor authentication for contact reveal', async () => {
    const req = request({ body: { inquiryId: inquiry.id } })
    let markerDuringService: unknown
    mocks.revealContact.mockImplementationOnce(async (serviceReq: PayloadRequest) => {
      markerDuringService = serviceReq.context?.inquiryContactReauthorized
      return {
        contact: { email: 'full@example.invalid', mode: 'full', phoneNumber: '+49 000 0000' },
        inquiryId: inquiry.id,
      }
    })

    const response = await clinicDashboardInquiryContactRevealPostHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.freshAuthentication).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSubject: 'supabase-staff-1',
        maxAgeSeconds: CLINIC_INQUIRY_CONTACT_REAUTH_MAX_AGE_SECONDS,
        token: 'clinic-token',
      }),
    )
    expect(markerDuringService).toBe(true)
    expect(req.context?.inquiryContactReauthorized).toBeUndefined()

    mocks.freshAuthentication.mockResolvedValueOnce({ status: 'reauthentication-required' })
    const stale = await clinicDashboardInquiryContactRevealPostHandler(request({ body: { inquiryId: inquiry.id } }))
    expect(await json(stale)).toEqual({
      status: 401,
      body: { error: { code: 'INQUIRY_REAUTHENTICATION_REQUIRED' } },
    })
  })

  it('keeps all inquiry mutations behind strict purpose-specific inputs', async () => {
    const noteReq = request({
      body: {
        idempotencyKey: 'note-key-1',
        inquiryId: inquiry.id,
        text: 'Clinic-only synthetic note',
      },
    })
    const stateReq = request({
      body: {
        action: 'close',
        expectedRevision: 4,
        inquiryId: inquiry.id,
        reason: 'Handled through a synthetic scenario',
      },
    })
    const draftReq = request({
      body: {
        fileName: 'report.pdf',
        inquiryId: inquiry.id,
        mimeType: 'application/pdf',
        sizeBytes: 4,
      },
    })
    const finalizeReq = request({ body: { draftId: 'draft-1', inquiryId: inquiry.id } })
    const discardReq = request({ body: { draftId: 'draft-1', inquiryId: inquiry.id } })

    expect((await clinicDashboardInquiryNotesPostHandler(noteReq)).status).toBe(200)
    expect((await clinicDashboardInquiryStatePatchHandler(stateReq)).status).toBe(200)
    expect((await clinicDashboardInquiryAttachmentDraftPostHandler(draftReq)).status).toBe(201)
    await expect(json(await clinicDashboardInquiryAttachmentFinalizePostHandler(finalizeReq))).resolves.toEqual({
      status: 200,
      body: { finalized: true },
    })
    await expect(json(await clinicDashboardInquiryAttachmentDiscardPostHandler(discardReq))).resolves.toEqual({
      status: 200,
      body: { discarded: true },
    })
    await vi.waitFor(() => expect(mocks.cleanup).toHaveBeenCalledWith(discardReq, { attachmentId: 'attachment-1' }))
    await vi.waitFor(() => expect(mocks.sweep).toHaveBeenCalled())
  })

  it('sequences discard cleanup and the orphan sweep in one caller-independent task', async () => {
    const tasks: Array<() => Promise<unknown> | unknown> = []
    const order: string[] = []
    mocks.after.mockImplementation((task: () => Promise<unknown> | unknown) => {
      tasks.push(task)
    })
    mocks.cleanup.mockImplementationOnce(async () => {
      order.push('cleanup')
      throw new Error('synthetic storage failure')
    })
    mocks.sweep.mockImplementationOnce(async () => {
      order.push('sweep')
      return { cleaned: 0, examined: 1 }
    })
    const req = request({ body: { draftId: 'draft-1', inquiryId: inquiry.id } })

    await expect(json(await clinicDashboardInquiryAttachmentDiscardPostHandler(req))).resolves.toEqual({
      status: 200,
      body: { discarded: true },
    })
    expect(mocks.after).toHaveBeenCalledTimes(1)
    expect(tasks).toHaveLength(1)
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(mocks.sweep).not.toHaveBeenCalled()

    await tasks[0]?.()

    expect(order).toEqual(['cleanup', 'sweep'])
    expect(mocks.cleanup).toHaveBeenCalledWith(req, { attachmentId: 'attachment-1' })
    expect(mocks.sweep).toHaveBeenCalledWith(req)
  })

  it.each([
    ['preview', clinicDashboardInquiryAttachmentPreviewGetHandler, 'inline; filename="report.pdf"'],
    ['download', clinicDashboardInquiryAttachmentDownloadGetHandler, 'attachment; filename="report.pdf"'],
  ] as const)(
    'proxies authorized %s bytes without exposing the signed storage URL',
    async (mode, handler, disposition) => {
      mocks.readAttachmentAccess.mockResolvedValue({
        expiresAt: '2026-08-24T12:00:30.000Z',
        method: 'GET',
        url: `https://storage.example.com/findmydoc-test/ready/report?response-content-disposition=${encodeURIComponent(disposition)}`,
      })
      const fetcher = vi.fn(
        async () =>
          new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
            headers: {
              'Content-Disposition': disposition,
              'Content-Length': '4',
              'Content-Type': 'application/pdf',
            },
          }),
      )
      vi.stubGlobal('fetch', fetcher)

      const response = await handler(request({ search: 'attachmentId=attachment-1' }))

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/pdf')
      expect(response.headers.get('content-disposition')).toBe(disposition)
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]))
      expect(mocks.readAttachmentAccess).toHaveBeenCalledWith(expect.anything(), {
        attachmentId: 'attachment-1',
        mode,
      })
      expect(fetcher).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'https://storage.example.com' }),
        expect.objectContaining({ redirect: 'error' }),
      )
      expectPrivateLive(response)
    },
  )

  it('rejects a signed access URL outside the configured storage origin without fetching it', async () => {
    mocks.readAttachmentAccess.mockResolvedValue({
      expiresAt: '2026-08-24T12:00:30.000Z',
      method: 'GET',
      url: 'https://untrusted.example.org/findmydoc-test/ready/report',
    })
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)

    const response = await clinicDashboardInquiryAttachmentPreviewGetHandler(
      request({ search: 'attachmentId=attachment-1' }),
    )

    expect(await json(response)).toEqual({
      status: 503,
      body: { error: { code: 'INQUIRY_SERVICE_UNAVAILABLE' } },
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each(['TimeoutError', 'AbortError'])('maps storage fetch %s to the safe timeout error', async (errorName) => {
    mocks.readAttachmentAccess.mockResolvedValue({
      expiresAt: '2026-08-24T12:00:30.000Z',
      method: 'GET',
      url: 'https://storage.example.com/findmydoc-test/ready/report?response-content-disposition=inline%3B',
    })
    const error = new Error('synthetic storage timeout')
    error.name = errorName
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(error)),
    )

    const response = await clinicDashboardInquiryAttachmentPreviewGetHandler(
      request({ search: 'attachmentId=attachment-1' }),
    )

    expect(await json(response)).toEqual({
      status: 504,
      body: { error: { code: 'INQUIRY_SERVICE_TIMEOUT' } },
    })
    expect(mocks.after).not.toHaveBeenCalled()
    expect(mocks.sweep).not.toHaveBeenCalled()
  })

  it('bounds an attachment body even when storage omits Content-Length', async () => {
    mocks.readAttachmentAccess.mockResolvedValue({
      expiresAt: '2026-08-24T12:00:30.000Z',
      method: 'GET',
      url: 'https://storage.example.com/findmydoc-test/ready/report?response-content-disposition=inline%3B',
    })
    const cancel = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              cancel,
              start(controller) {
                controller.enqueue(new Uint8Array(3 * 1024 * 1024))
                controller.enqueue(new Uint8Array(3 * 1024 * 1024))
              },
            }),
            {
              headers: {
                'Content-Disposition': 'inline;',
                'Content-Type': 'application/pdf',
              },
            },
          ),
      ),
    )

    const response = await clinicDashboardInquiryAttachmentPreviewGetHandler(
      request({ search: 'attachmentId=attachment-1' }),
    )

    expect(await json(response)).toEqual({
      status: 413,
      body: { error: { code: 'INQUIRY_PAYLOAD_TOO_LARGE' } },
    })
    expect(cancel).toHaveBeenCalledOnce()
    expect(mocks.after).not.toHaveBeenCalled()
    expect(mocks.sweep).not.toHaveBeenCalled()
  })

  it('does not trigger attachment cleanup from an unauthorized request', async () => {
    mocks.bearer.mockResolvedValueOnce({ status: 'invalid' })

    const response = await clinicDashboardInquiryAttachmentPreviewGetHandler(
      request({ search: 'attachmentId=attachment-1' }),
    )

    expect(response.status).toBe(401)
    expect(mocks.readAttachmentAccess).not.toHaveBeenCalled()
    expect(mocks.after).not.toHaveBeenCalled()
    expect(mocks.sweep).not.toHaveBeenCalled()
  })
})
