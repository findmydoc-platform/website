import type { PayloadRequest } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  patientInquiriesGetHandler,
  patientInquiryAttachmentDiscardPostHandler,
  patientInquiryAttachmentDownloadGetHandler,
  patientInquiryAttachmentDraftPostHandler,
  patientInquiryAttachmentFinalizePostHandler,
  patientInquiryDetailGetHandler,
  patientInquiryMessagesPostHandler,
  patientInquiryReadPositionPutHandler,
} from '@/endpoints/patientInquiries'
import type { InquiryDetailDTO } from '@/features/inquiryCommunication/contracts'
import { InquiryCommunicationServiceError } from '@/features/inquiryCommunication/service'

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  cleanup: vi.fn(),
  createDraft: vi.fn(),
  discardDraft: vi.fn(),
  finalizeDraft: vi.fn(),
  readAttachmentAccess: vi.fn(),
  readDetail: vi.fn(),
  readQueue: vi.fn(),
  sendMessage: vi.fn(),
  sweep: vi.fn(),
  updateReadPosition: vi.fn(),
}))

vi.mock('next/server.js', () => ({ after: mocks.after }))

vi.mock('@/features/inquiryCommunication/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/inquiryCommunication/service')>()),
  createAttachmentDraft: mocks.createDraft,
  cleanupDiscardedAttachment: mocks.cleanup,
  discardAttachmentDraft: mocks.discardDraft,
  finalizeAttachmentDraft: mocks.finalizeDraft,
  readAttachmentAccess: mocks.readAttachmentAccess,
  readPatientInquiryDetailResult: mocks.readDetail,
  readPatientInquiryQueue: mocks.readQueue,
  sendPatientInquiryMessage: mocks.sendMessage,
  sweepExpiredAttachmentDrafts: mocks.sweep,
  updatePatientInquiryReadPosition: mocks.updateReadPosition,
}))

vi.mock('@/plugins/storageConfig', () => ({
  resolveS3StorageConfig: () => ({
    bucket: 'findmydoc-test',
    clientConfig: { endpoint: 'https://storage.example.com' },
  }),
}))

const inquiry = {
  id: 'inquiry-patient-1',
  revision: 3,
  unread: { count: 1, isUnread: true },
}

const request = ({
  body,
  collection = 'patients',
  search = '',
}: {
  body?: unknown
  collection?: 'clinicStaff' | 'patients' | 'platformStaff' | null
  search?: string
} = {}): PayloadRequest =>
  ({
    context: {},
    headers: new Headers({ 'content-type': 'application/json' }),
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
    user: collection
      ? {
          id: collection === 'patients' ? 'patient-1' : 'other-actor-1',
          collection,
        }
      : undefined,
  }) as unknown as PayloadRequest

const json = async (response: Response) => ({ body: await response.json(), status: response.status })

const expectPrivateLive = (response: Response): void => {
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
  expect(response.headers.get('expires')).toBe('0')
  expect(response.headers.get('vary')).toBe('Authorization, Cookie')
}

describe('patient inquiry endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.after.mockImplementation((task: () => Promise<unknown> | unknown) => {
      void task()
    })
    mocks.readQueue.mockResolvedValue({
      changeCursor: 'patient-change-1',
      counts: { all: 1, closed: 0, open: 1 },
      items: [inquiry],
      unchanged: false,
      unreadCount: 1,
    })
    mocks.readDetail.mockResolvedValue({
      changeCursor: 'detail-change-1',
      inquiry,
      unchanged: false,
    })
    mocks.sendMessage.mockResolvedValue({ inquiry, replayed: false })
    mocks.updateReadPosition.mockResolvedValue({ inquiry: { ...inquiry, unread: { count: 0, isUnread: false } } })
    mocks.createDraft.mockResolvedValue({
      draftId: 'draft-1',
      expiresAt: '2026-08-25T12:00:00.000Z',
      upload: {
        headers: { 'content-type': 'application/pdf' },
        method: 'PUT',
        url: 'https://storage.example.invalid/synthetic-draft',
      },
    })
    mocks.finalizeDraft.mockResolvedValue({
      attachment: { fileName: 'report.pdf', id: 'attachment-1', mimeType: 'application/pdf', sizeBytes: 4 },
    })
    mocks.discardDraft.mockResolvedValue({ attachmentId: 'attachment-1', discarded: true })
    mocks.cleanup.mockResolvedValue(undefined)
    mocks.sweep.mockResolvedValue({ cleaned: 0, examined: 0 })
    mocks.readAttachmentAccess.mockResolvedValue({
      expiresAt: '2026-08-25T12:00:00.000Z',
      method: 'GET',
      url: 'https://storage.example.com/findmydoc-test/ready/signed?response-content-disposition=attachment%3B%20filename%3Dreport.pdf',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses the bounded patient queue without accepting participant scope from the browser', async () => {
    const req = request({ search: 'cursor=opaque-cursor&lifecycle=open&limit=20' })

    const response = await patientInquiriesGetHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.readQueue).toHaveBeenCalledWith(req, {
      cursor: 'opaque-cursor',
      lifecycle: 'open',
      limit: 20,
    })
    expectPrivateLive(response)

    const expanded = await patientInquiriesGetHandler(request({ search: 'patientId=patient-2' }))
    expect(await json(expanded)).toEqual({
      status: 400,
      body: { error: { code: 'INQUIRY_INVALID_INPUT' } },
    })
    expect(mocks.readQueue).toHaveBeenCalledOnce()
  })

  it.each([
    ['missing session', null, 401, 'INQUIRY_UNAUTHORIZED'],
    ['clinic actor', 'clinicStaff' as const, 403, 'INQUIRY_ACCESS_DENIED'],
    ['platform actor', 'platformStaff' as const, 403, 'INQUIRY_ACCESS_DENIED'],
  ])('fails closed for a %s before domain access', async (_case, collection, status, code) => {
    const response = await patientInquiriesGetHandler(request({ collection }))

    expect(await json(response)).toEqual({ status, body: { error: { code } } })
    expect(mocks.readQueue).not.toHaveBeenCalled()
    expectPrivateLive(response)
  })

  it('authorizes before parsing browser input', async () => {
    const invalidQueue = await patientInquiriesGetHandler(request({ collection: null, search: 'patientId=patient-2' }))
    const invalidBody = await patientInquiryMessagesPostHandler(
      request({ collection: null, body: { patientId: 'patient-2' } }),
    )

    expect(invalidQueue.status).toBe(401)
    expect(invalidBody.status).toBe(401)
    expect(mocks.readQueue).not.toHaveBeenCalled()
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  it('keeps missing and foreign patient inquiries indistinguishable', async () => {
    mocks.readDetail.mockRejectedValue(new InquiryCommunicationServiceError('not-found', 'private detail'))

    const missing = await patientInquiryDetailGetHandler(request({ search: 'inquiryId=missing' }))
    const foreign = await patientInquiryDetailGetHandler(request({ search: 'inquiryId=foreign' }))

    expect(await json(missing)).toEqual({ status: 404, body: { error: { code: 'INQUIRY_NOT_FOUND' } } })
    expect(await json(foreign)).toEqual({ status: 404, body: { error: { code: 'INQUIRY_NOT_FOUND' } } })
  })

  it('forwards opaque detail markers and returns the stable detail result shape', async () => {
    const req = request({
      search: `inquiryId=${inquiry.id}&knownChangeCursor=detail-change-0&knownRevision=${inquiry.revision}`,
    })

    const response = await patientInquiryDetailGetHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.readDetail).toHaveBeenCalledWith(req, {
      inquiryId: inquiry.id,
      knownChangeCursor: 'detail-change-0',
      knownRevision: inquiry.revision,
    })
    await expect(response.json()).resolves.toEqual({
      changeCursor: 'detail-change-1',
      inquiry,
      unchanged: false,
    })
  })

  it('forwards confirmed message and visible read mutations without client actor input', async () => {
    const messageInput = {
      attachmentDraftId: 'draft-1',
      expectedRevision: 3,
      idempotencyKey: 'patient-message-key-1',
      inquiryId: inquiry.id,
      text: 'Synthetic patient reply.',
    }
    const messageReq = request({ body: messageInput })

    const messageResponse = await patientInquiryMessagesPostHandler(messageReq)

    expect(messageResponse.status).toBe(200)
    expect(mocks.sendMessage).toHaveBeenCalledWith(messageReq, messageInput)
    expectPrivateLive(messageResponse)

    const readInput = { activityId: 'message-1', inquiryId: inquiry.id, mode: 'read' }
    const readReq = request({ body: readInput })
    const readResponse = await patientInquiryReadPositionPutHandler(readReq)

    expect(readResponse.status).toBe(200)
    expect(mocks.updateReadPosition).toHaveBeenCalledWith(readReq, readInput)
    await expect(readResponse.json()).resolves.toEqual({ unread: { count: 0, isUnread: false } })

    const injected = await patientInquiryMessagesPostHandler(
      request({ body: { ...messageInput, patientId: 'patient-2' } }),
    )
    expect(await json(injected)).toEqual({
      status: 400,
      body: { error: { code: 'INQUIRY_INVALID_INPUT' } },
    })
    expect(mocks.sendMessage).toHaveBeenCalledOnce()
  })

  it('maps safe current conflicts and ambiguous service timeouts without exposing messages', async () => {
    const current = { ...inquiry, revision: 4 } as InquiryDetailDTO
    mocks.sendMessage.mockRejectedValueOnce(
      new InquiryCommunicationServiceError('conflict', 'private conflict', current),
    )
    const conflict = await patientInquiryMessagesPostHandler(
      request({
        body: {
          expectedRevision: 3,
          idempotencyKey: 'patient-message-key-1',
          inquiryId: inquiry.id,
          text: 'Synthetic conflict.',
        },
      }),
    )
    expect(await json(conflict)).toEqual({
      status: 409,
      body: { error: { code: 'INQUIRY_CONFLICT', current } },
    })

    mocks.sendMessage.mockRejectedValueOnce(new InquiryCommunicationServiceError('service-timeout', 'private timeout'))
    const timeout = await patientInquiryMessagesPostHandler(
      request({
        body: {
          expectedRevision: 3,
          idempotencyKey: 'patient-message-key-2',
          inquiryId: inquiry.id,
          text: 'Synthetic timeout.',
        },
      }),
    )
    expect(await json(timeout)).toEqual({
      status: 504,
      body: { error: { code: 'INQUIRY_SERVICE_TIMEOUT' } },
    })
  })

  it('exposes the actor-bound attachment draft lifecycle without accepting storage keys', async () => {
    const createInput = {
      fileName: 'report.pdf',
      inquiryId: inquiry.id,
      mimeType: 'application/pdf',
      sizeBytes: 4,
    }
    const createReq = request({ body: createInput })
    const created = await patientInquiryAttachmentDraftPostHandler(createReq)

    expect(created.status).toBe(201)
    expect(mocks.createDraft).toHaveBeenCalledWith(createReq, createInput)

    const mutationInput = { draftId: 'draft-1', inquiryId: inquiry.id }
    const finalizeReq = request({ body: mutationInput })
    const finalized = await patientInquiryAttachmentFinalizePostHandler(finalizeReq)
    expect(finalized.status).toBe(200)
    expect(mocks.finalizeDraft).toHaveBeenCalledWith(finalizeReq, mutationInput)
    await expect(finalized.json()).resolves.toEqual({ finalized: true })

    const discardReq = request({ body: mutationInput })
    const discarded = await patientInquiryAttachmentDiscardPostHandler(discardReq)
    expect(discarded.status).toBe(200)
    expect(mocks.discardDraft).toHaveBeenCalledWith(discardReq, mutationInput)
    await expect(discarded.json()).resolves.toEqual({ discarded: true })
    expect(mocks.after).toHaveBeenCalledTimes(3)
    await vi.waitFor(() => {
      expect(mocks.sweep).toHaveBeenCalledTimes(3)
      expect(mocks.cleanup).toHaveBeenCalledWith(discardReq, { attachmentId: 'attachment-1' })
    })

    const expanded = await patientInquiryAttachmentDraftPostHandler(
      request({ body: { ...createInput, objectKey: 'browser-controlled-key' } }),
    )
    expect(await json(expanded)).toEqual({
      status: 400,
      body: { error: { code: 'INQUIRY_INVALID_INPUT' } },
    })
  })

  it('proxies an authorized attachment without exposing the signed storage URL', async () => {
    const storedBytes = new Uint8Array([37, 80, 68, 70])
    const fetchMock = vi.fn(
      async () =>
        new Response(storedBytes, {
          status: 200,
          headers: {
            'content-disposition': 'attachment; filename=report.pdf',
            'content-length': String(storedBytes.byteLength),
            'content-type': 'application/pdf',
          },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const req = request({ search: 'attachmentId=attachment-1' })
    const response = await patientInquiryAttachmentDownloadGetHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.readAttachmentAccess).toHaveBeenCalledWith(req, {
      attachmentId: 'attachment-1',
      mode: 'download',
    })
    expect(response.headers.get('content-disposition')).toBe('attachment; filename=report.pdf')
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('location')).toBeNull()
    expectPrivateLive(response)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(storedBytes)
  })

  it('rejects unsafe storage origins before fetching bytes', async () => {
    mocks.readAttachmentAccess.mockResolvedValueOnce({
      expiresAt: '2026-08-25T12:00:00.000Z',
      method: 'GET',
      url: 'https://attacker.example.invalid/findmydoc-test/ready/signed',
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await patientInquiryAttachmentDownloadGetHandler(request({ search: 'attachmentId=attachment-1' }))

    expect(await json(response)).toEqual({
      status: 503,
      body: { error: { code: 'INQUIRY_SERVICE_UNAVAILABLE' } },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
