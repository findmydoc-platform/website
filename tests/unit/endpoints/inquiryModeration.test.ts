import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clinicInquiryAppealPostHandler,
  clinicInquiryReportPostHandler,
  patientInquiryAppealPostHandler,
  patientInquiryReportPostHandler,
  platformInquiryModerationCaseReadPostHandler,
  platformInquiryModerationDecisionPostHandler,
} from '@/endpoints/inquiryModeration'

const mocks = vi.hoisted(() => ({
  authorizeClinic: vi.fn(),
  decideCase: vi.fn(),
  createReport: vi.fn(),
  readCase: vi.fn(),
  submitAppeal: vi.fn(),
}))

vi.mock('@/features/inquiryModeration/service', () => ({
  createInquiryModerationReport: mocks.createReport,
  decideInquiryModerationCase: mocks.decideCase,
  readInquiryModerationCase: mocks.readCase,
  submitInquiryModerationAppeal: mocks.submitAppeal,
  InquiryModerationServiceError: class InquiryModerationServiceError extends Error {
    constructor(readonly kind: string) {
      super(kind)
    }
  },
}))

vi.mock('@/features/clinicDashboard/authorization', () => ({
  revalidateClinicDashboardRequest: mocks.authorizeClinic,
}))

const request = ({
  body,
  collection = 'patients',
  contract,
}: { body?: unknown; collection?: string | null; contract?: string } = {}) =>
  ({
    context: {},
    headers: new Headers({
      'content-type': 'application/json',
      ...(contract ? { 'x-findmydoc-clinic-dashboard-contract': contract } : {}),
    }),
    json: vi.fn(async () => body),
    payload: {
      logger: { error: vi.fn() },
    },
    searchParams: new URLSearchParams(),
    user: collection ? { collection, id: `${collection}-1` } : undefined,
  }) as unknown as PayloadRequest

describe('inquiry moderation endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authorizeClinic.mockResolvedValue({
      data: { capabilities: ['clinic-inquiries:view', 'clinic-inquiries:edit'] },
      status: 'authorized',
    })
    mocks.decideCase.mockResolvedValue({ decided: true })
    mocks.createReport.mockResolvedValue({ received: true, reportId: 'report-1' })
    mocks.readCase.mockResolvedValue({ caseId: 'case-1', category: 'privacy-concern', context: [], target: {} })
    mocks.submitAppeal.mockResolvedValue({ submitted: true })
  })

  it('accepts one strict patient report without browser-controlled actor scope', async () => {
    const req = request({
      body: {
        category: 'privacy-concern',
        description: 'This was sent to the wrong person.',
        idempotencyKey: 'report-key-0001',
        inquiryId: 'inquiry-1',
        targetId: 'message-1',
        targetType: 'message',
      },
    })

    const response = await patientInquiryReportPostHandler(req)

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ received: true, reportId: 'report-1' })
    expect(mocks.createReport).toHaveBeenCalledWith(req, {
      category: 'privacy-concern',
      description: 'This was sent to the wrong person.',
      idempotencyKey: 'report-key-0001',
      inquiryId: 'inquiry-1',
      targetId: 'message-1',
      targetType: 'message',
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it.each([
    ['actor injection', { reporterId: 'patient-2' }],
    ['internal note target', { targetType: 'internal-note' }],
    ['other without description', { category: 'other', description: undefined }],
  ])('rejects %s before domain access', async (_case, override) => {
    const response = await patientInquiryReportPostHandler(
      request({
        body: {
          category: 'privacy-concern',
          description: 'Synthetic report detail.',
          idempotencyKey: 'report-key-0001',
          inquiryId: 'inquiry-1',
          targetId: 'message-1',
          targetType: 'message',
          ...override,
        },
      }),
    )

    expect(response.status).toBe(400)
    expect(mocks.createReport).not.toHaveBeenCalled()
  })

  it('authorizes the patient before parsing the report body', async () => {
    const req = request({ body: { reporterId: 'patient-2' }, collection: null })

    const response = await patientInquiryReportPostHandler(req)

    expect(response.status).toBe(401)
    expect(mocks.createReport).not.toHaveBeenCalled()
  })

  it('maps a persistent report rate limit to 429 without leaking service detail', async () => {
    const { InquiryModerationServiceError } = await import('@/features/inquiryModeration/service')
    mocks.createReport.mockRejectedValueOnce(new InquiryModerationServiceError('rate-limited', 'private detail'))

    const response = await patientInquiryReportPostHandler(
      request({
        body: {
          category: 'privacy-concern',
          idempotencyKey: 'report-key-rate-limit',
          inquiryId: 'inquiry-1',
          targetId: 'message-1',
          targetType: 'message',
        },
      }),
    )

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: { code: 'MODERATION_RATE_LIMITED' } })
  })

  it('accepts the same strict report contract for an authorized clinic participant', async () => {
    const req = request({
      body: {
        category: 'spam-fraud-impersonation',
        idempotencyKey: 'clinic-report-key-1',
        inquiryId: 'inquiry-1',
        targetId: 'message-1',
        targetType: 'message',
      },
      collection: 'clinicStaff',
      contract: 'inquiry-communication-v1',
    })

    const response = await clinicInquiryReportPostHandler(req)

    expect(response.status).toBe(201)
    expect(mocks.authorizeClinic).toHaveBeenCalledWith(req, 'inquiry')
    expect(mocks.createReport).toHaveBeenCalledOnce()
  })

  it('rejects a clinic report before domain access when contract negotiation is absent', async () => {
    const response = await clinicInquiryReportPostHandler(request({ body: {}, collection: 'clinicStaff' }))

    expect(response.status).toBe(400)
    expect(mocks.authorizeClinic).not.toHaveBeenCalled()
    expect(mocks.createReport).not.toHaveBeenCalled()
  })

  it.each([
    ['patient', patientInquiryAppealPostHandler, undefined],
    ['clinic', clinicInquiryAppealPostHandler, 'inquiry-communication-v1'],
  ])('accepts one strict %s appeal', async (_name, handler, contract) => {
    const req = request({
      body: { caseId: 'case-1', text: 'Synthetic appeal text.' },
      collection: _name === 'patient' ? 'patients' : 'clinicStaff',
      contract,
    })

    const response = await handler(req)

    expect(response.status).toBe(201)
    expect(mocks.submitAppeal).toHaveBeenCalledWith(req, {
      caseId: 'case-1',
      text: 'Synthetic appeal text.',
    })
  })

  it('keeps moderator read and decisions behind a platform principal', async () => {
    const denied = await platformInquiryModerationCaseReadPostHandler(
      request({ body: { caseId: 'case-1', scope: 'reported-object' }, collection: 'clinicStaff' }),
    )
    expect(denied.status).toBe(403)
    expect(mocks.readCase).not.toHaveBeenCalled()

    const req = request({
      body: {
        caseId: 'case-1',
        category: 'privacy-concern',
        outcome: 'content-restricted',
        reason: 'Synthetic moderation reason.',
      },
      collection: 'platformStaff',
    })
    const decided = await platformInquiryModerationDecisionPostHandler(req)
    expect(decided.status).toBe(200)
    expect(mocks.decideCase).toHaveBeenCalledOnce()
  })
})
