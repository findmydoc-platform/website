import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const findMock = vi.fn()
const findByIDMock = vi.fn()
const createMock = vi.fn()
const loggerMock = { error: vi.fn(), info: vi.fn() }

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()

  return {
    ...actual,
    buildConfig: (cfg: unknown) => cfg,
    getPayload: async () => ({
      find: findMock,
      findByID: findByIDMock,
      create: createMock,
      logger: loggerMock,
    }),
  }
})

import { POST } from '@/app/api/clinic-contact-requests/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/clinic-contact-requests', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      referer: 'https://preview.findmydoc.eu/clinics/berlin-health',
      'user-agent': 'vitest',
      'x-forwarded-for': '203.0.113.1',
    },
  })
}

const validBody = {
  clinicId: 1,
  doctorId: 601,
  treatmentId: 301,
  fullName: 'Jane Patient',
  email: 'Jane.Patient@Example.com',
  phoneNumber: '+49 30 123456',
  preferredDate: '2026-05-25',
  preferredTime: '10:30',
  message: 'I would like to discuss treatment options.',
  consent: true,
}

function mockSuccessfulLookups() {
  findMock.mockImplementation(async (args: { collection: string }) => {
    if (args.collection === 'clinics') {
      return { docs: [{ id: 1, name: 'Berlin Health Clinic', slug: 'berlin-health', status: 'approved' }] }
    }

    if (args.collection === 'doctors') {
      return { docs: [{ id: 601, fullName: 'Dr. Ada Care', clinic: 1 }] }
    }

    if (args.collection === 'clinictreatments') {
      return {
        docs: [
          {
            id: 201,
            clinic: 1,
            treatment: { id: 301, name: 'Routine Checkup' },
          },
        ],
      }
    }

    return { docs: [] }
  })
}

describe('POST /api/clinic-contact-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMock.mockResolvedValue({ id: 42, status: 'submitted' })
  })

  it('rejects requests without consent', async () => {
    const response = await POST(makeRequest({ ...validBody, consent: false }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Consent is required.')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('requires a doctor or treatment selection', async () => {
    const response = await POST(makeRequest({ ...validBody, doctorId: undefined, treatmentId: undefined }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Select a doctor or treatment.')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('rejects non-approved or missing clinics', async () => {
    findMock.mockResolvedValueOnce({ docs: [] })

    const response = await POST(makeRequest(validBody))
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Clinic not found.')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('rejects a doctor that is not attached to the clinic', async () => {
    findMock.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'clinics') {
        return { docs: [{ id: 1, name: 'Berlin Health Clinic', slug: 'berlin-health', status: 'approved' }] }
      }

      if (args.collection === 'doctors') return { docs: [] }

      if (args.collection === 'clinictreatments') {
        return { docs: [{ id: 201, clinic: 1, treatment: { id: 301, name: 'Routine Checkup' } }] }
      }

      return { docs: [] }
    })

    const response = await POST(makeRequest(validBody))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Doctor is not available for this clinic.')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('rejects a treatment that is not offered by the clinic', async () => {
    findMock.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'clinics') {
        return { docs: [{ id: 1, name: 'Berlin Health Clinic', slug: 'berlin-health', status: 'approved' }] }
      }

      if (args.collection === 'doctors') {
        return { docs: [{ id: 601, fullName: 'Dr. Ada Care', clinic: 1 }] }
      }

      if (args.collection === 'clinictreatments') return { docs: [] }

      return { docs: [] }
    })

    const response = await POST(makeRequest(validBody))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Treatment is not available for this clinic.')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('creates an inquiry with clinic context and CRM-neutral sync metadata', async () => {
    mockSuccessfulLookups()

    const response = await POST(makeRequest(validBody))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true, id: 42, status: 'submitted' })
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'patientClinicInquiries',
        overrideAccess: true,
        data: expect.objectContaining({
          clinic: 1,
          clinicNameSnapshot: 'Berlin Health Clinic',
          doctor: 601,
          doctorNameSnapshot: 'Dr. Ada Care',
          treatment: 301,
          treatmentNameSnapshot: 'Routine Checkup',
          fullName: 'Jane Patient',
          email: 'jane.patient@example.com',
          phoneNumber: '+49 30 123456',
          message: 'I would like to discuss treatment options.',
          status: 'submitted',
          nextStep: 'platform-review',
          source: 'clinic_profile',
          formUrl: 'https://preview.findmydoc.eu/clinics/berlin-health',
          syncStatus: 'not_configured',
          consent: expect.objectContaining({ accepted: true }),
          sourceMeta: expect.objectContaining({ ip: '203.0.113.1', userAgent: 'vitest' }),
        }),
      }),
    )
  })
})
