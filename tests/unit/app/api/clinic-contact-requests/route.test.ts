import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createVerifiedInquiry: vi.fn(),
  createLocalReq: vi.fn(),
  getPayload: vi.fn(),
  submitGuestInquiry: vi.fn(),
}))

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  buildConfig: (config: unknown) => config,
  createLocalReq: mocks.createLocalReq,
  getPayload: mocks.getPayload,
}))

vi.mock('@/features/inquiryCommunication/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/inquiryCommunication/service')>()),
  createVerifiedPatientInquiry: mocks.createVerifiedInquiry,
  submitGuestClinicInquiry: mocks.submitGuestInquiry,
}))

import { InquiryCommunicationServiceError } from '@/features/inquiryCommunication/service'
import { POST } from '@/app/api/clinic-contact-requests/route'

const payload = {
  logger: { error: vi.fn(), info: vi.fn() },
}
const localReq = { context: {}, payload }

const validBody = {
  clinicId: 1,
  consent: true,
  doctorId: 601,
  email: 'Jane.Patient@Example.com',
  fullName: ' Jane Patient ',
  idempotencyKey: 'contact-request-key-1',
  message: 'First line\nSecond line',
  phoneNumber: '+49 30 123456',
  preferredContactWindow: 'morning',
  treatmentId: 301,
  treatmentTimeline: 'within_two_weeks',
}

const makeRequest = (body: unknown): NextRequest =>
  new NextRequest('http://localhost/api/clinic-contact-requests', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

describe('POST /api/clinic-contact-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPayload.mockResolvedValue(payload)
    mocks.createLocalReq.mockResolvedValue(localReq)
    mocks.createVerifiedInquiry.mockResolvedValue({
      inquiry: { handlingStatus: 'submitted', id: '43' },
      replayed: false,
    })
    mocks.submitGuestInquiry.mockResolvedValue({ deduped: false, id: '42', status: 'submitted' })
  })

  it('parses the public request and delegates one normalized guest command', async () => {
    const request = makeRequest(validBody)

    const response = await POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, id: '42', status: 'submitted' })
    expect(mocks.createLocalReq).toHaveBeenCalledWith(
      expect.objectContaining({ req: expect.objectContaining({ headers: request.headers }) }),
      payload,
    )
    expect(mocks.submitGuestInquiry).toHaveBeenCalledWith(localReq, {
      ...validBody,
      email: 'jane.patient@example.com',
      fullName: 'Jane Patient',
    })
    expect(mocks.createVerifiedInquiry).not.toHaveBeenCalled()
  })

  it('binds an authenticated patient submission through the verified inquiry command', async () => {
    const patientReq = { ...localReq, user: { collection: 'patients', id: 17 } }
    mocks.createLocalReq.mockResolvedValueOnce(patientReq)

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, id: '43', status: 'submitted' })
    expect(mocks.createVerifiedInquiry).toHaveBeenCalledWith(patientReq, {
      ...validBody,
      clinicId: '1',
      doctorId: '601',
      email: 'jane.patient@example.com',
      fullName: 'Jane Patient',
      treatmentId: '301',
    })
    expect(mocks.submitGuestInquiry).not.toHaveBeenCalled()
  })

  it('preserves a recent duplicate as the historical successful response', async () => {
    mocks.submitGuestInquiry.mockResolvedValueOnce({ deduped: true, id: '41', status: 'submitted' })

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      deduped: true,
      id: '41',
      status: 'submitted',
    })
  })

  it.each([
    ['missing consent', { ...validBody, consent: false }, 'Consent is required.'],
    [
      'missing interest',
      { ...validBody, doctorId: undefined, treatmentId: undefined },
      'Select a doctor or treatment.',
    ],
    ['blank message', { ...validBody, message: '  \n ' }, 'Message is required.'],
    ['oversized message', { ...validBody, message: 'x'.repeat(3_001) }, 'Invalid request payload.'],
    ['unknown field', { ...validBody, actorId: 'patient-1' }, 'Invalid request payload.'],
  ])('rejects %s before constructing a domain request', async (_case, body, error) => {
    const response = await POST(makeRequest(body))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error })
    expect(mocks.createLocalReq).not.toHaveBeenCalled()
    expect(mocks.submitGuestInquiry).not.toHaveBeenCalled()
    expect(mocks.createVerifiedInquiry).not.toHaveBeenCalled()
  })

  it.each([
    ['not-found', 'Clinic not found.', 404],
    ['invalid-input', 'Doctor is not available for this clinic.', 400],
  ] as const)('maps a safe domain %s without exposing internals', async (kind, message, status) => {
    mocks.submitGuestInquiry.mockRejectedValueOnce(new InquiryCommunicationServiceError(kind, message))

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ error: message })
  })

  it('maps unexpected command failure to the existing safe response', async () => {
    mocks.submitGuestInquiry.mockRejectedValueOnce(new Error('private database detail'))

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Could not submit clinic request.' })
  })
})
