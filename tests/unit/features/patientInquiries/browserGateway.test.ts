import { afterEach, describe, expect, it, vi } from 'vitest'

import { PatientInquiriesApiError, createPatientInquiriesBrowserApi } from '@/features/patientInquiries/browserGateway'

const response = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('patient inquiries browser gateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads a filtered queue through the same-origin private endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        changeCursor: 'queue-1',
        counts: { all: 0, closed: 0, open: 0 },
        items: [],
        unchanged: false,
        unreadCount: 0,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const api = createPatientInquiriesBrowserApi()
    await api.readQueue({ lifecycle: 'closed', limit: 25 })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/patient/inquiries?lifecycle=closed&limit=25',
      expect.objectContaining({ cache: 'no-store', credentials: 'same-origin', method: 'GET' }),
    )
  })

  it('passes detail markers without exposing actor identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ changeCursor: 'detail-2', inquiry: { id: 'inquiry-1' }, unchanged: true }))
    vi.stubGlobal('fetch', fetchMock)

    const api = createPatientInquiriesBrowserApi()
    await api.readDetail({ inquiryId: 'inquiry-1', knownChangeCursor: 'detail-1', knownRevision: 3 })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/patient/inquiries/detail?inquiryId=inquiry-1&knownChangeCursor=detail-1&knownRevision=3',
      expect.objectContaining({ credentials: 'same-origin', method: 'GET' }),
    )
  })

  it('marks an interrupted send as ambiguous and retains the safe current snapshot from conflicts', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network interrupted'))
      .mockResolvedValueOnce(
        response(
          {
            error: {
              code: 'INQUIRY_CONFLICT',
              current: { id: 'inquiry-1', revision: 4 },
            },
          },
          409,
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const api = createPatientInquiriesBrowserApi()
    const input = {
      expectedRevision: 3,
      idempotencyKey: 'message-key-1234',
      inquiryId: 'inquiry-1',
      text: 'Hello clinic',
    }

    await expect(api.sendMessage(input)).rejects.toMatchObject({
      ambiguous: true,
      code: 'INQUIRY_SERVICE_UNAVAILABLE',
    })
    await expect(api.sendMessage(input)).rejects.toMatchObject({
      ambiguous: false,
      code: 'INQUIRY_CONFLICT',
      current: { id: 'inquiry-1', revision: 4 },
    })
  })

  it('uploads a draft directly without forwarding patient cookies', async () => {
    const progress: Array<number | undefined> = []
    const xhr = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      status: 200,
      upload: {},
      withCredentials: true,
    } as unknown as XMLHttpRequest
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(function XMLHttpRequestMock() {
        return xhr
      }),
    )
    const file = new File(['scan'], 'scan.pdf', { type: 'application/pdf' })

    const api = createPatientInquiriesBrowserApi()
    const uploaded = api.uploadDraft({
      file,
      onProgress: (value) => progress.push(value),
      upload: {
        headers: { 'Content-Type': 'application/pdf', 'x-amz-meta-token': 'synthetic' },
        method: 'PUT',
        url: 'https://storage.example.test/drafts/signed',
      },
    })
    xhr.upload.onprogress?.call(xhr, {
      lengthComputable: true,
      loaded: 5,
      total: 10,
    } as ProgressEvent<XMLHttpRequestEventTarget>)
    xhr.onload?.({} as ProgressEvent<XMLHttpRequestEventTarget>)
    await uploaded

    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://storage.example.test/drafts/signed', true)
    expect(xhr.withCredentials).toBe(false)
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf')
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('x-amz-meta-token', 'synthetic')
    expect(xhr.send).toHaveBeenCalledWith(file)
    expect(progress).toEqual([50, 100])
  })

  it('builds attachment downloads as encoded same-origin hrefs', () => {
    const api = createPatientInquiriesBrowserApi()

    expect(api.attachmentDownloadHref('attachment/1')).toBe(
      '/api/patient/inquiries/attachments/download?attachmentId=attachment%2F1',
    )
  })

  it('uses a typed error for malformed success responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ nope: true })))

    const api = createPatientInquiriesBrowserApi()

    await expect(api.readQueue({ lifecycle: 'all' })).rejects.toBeInstanceOf(PatientInquiriesApiError)
  })
})
