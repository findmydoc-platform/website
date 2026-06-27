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
  treatmentTimeline: 'within_two_weeks',
  preferredContactWindow: 'morning',
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

function makeExistingInquiry(overrides: Record<string, unknown> = {}) {
  return {
    id: 99,
    clinic: 1,
    doctor: 601,
    treatment: 301,
    fullName: 'Jane Patient',
    email: 'jane.patient@example.com',
    phoneNumber: '+49 30 123456',
    treatmentTimeline: 'within_two_weeks',
    preferredContactWindow: 'morning',
    message: 'I would like to discuss treatment options.',
    status: 'submitted',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function mockSuccessfulLookupsWithInquiries(inquiries: Array<Record<string, unknown>>) {
  findMock.mockImplementation(async (args: { collection: string }) => {
    if (args.collection === 'clinics') {
      return { docs: [{ id: 1, name: 'Berlin Health Clinic', slug: 'berlin-health', status: 'approved' }] }
    }

    if (args.collection === 'doctors') {
      return { docs: [{ id: 601, fullName: 'Dr. Ada Care', clinic: 1 }] }
    }

    if (args.collection === 'clinictreatments') {
      return { docs: [{ id: 201, clinic: 1, treatment: { id: 301, name: 'Routine Checkup' } }] }
    }

    if (args.collection === 'patientClinicInquiries') {
      return { docs: inquiries }
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

  it('creates an inquiry with clinic context and submitted contact details', async () => {
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
          doctor: 601,
          treatment: 301,
          fullName: 'Jane Patient',
          email: 'jane.patient@example.com',
          phoneNumber: '+49 30 123456',
          treatmentTimeline: 'within_two_weeks',
          preferredContactWindow: 'morning',
          message: 'I would like to discuss treatment options.',
          status: 'submitted',
          consent: expect.objectContaining({ accepted: true }),
        }),
      }),
    )

    const createArgs = createMock.mock.calls[0]?.[0]
    expect(createArgs?.data).not.toHaveProperty('preferredDate')
    expect(createArgs?.data).not.toHaveProperty('preferredTime')
    expect(createArgs?.data).not.toHaveProperty('formUrl')
    expect(createArgs?.data).not.toHaveProperty('sourceMeta')
  })

  it('returns an existing inquiry for an identical recent duplicate request', async () => {
    findMock.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'clinics') {
        return { docs: [{ id: 1, name: 'Berlin Health Clinic', slug: 'berlin-health', status: 'approved' }] }
      }

      if (args.collection === 'doctors') {
        return { docs: [{ id: 601, fullName: 'Dr. Ada Care', clinic: 1 }] }
      }

      if (args.collection === 'clinictreatments') {
        return { docs: [{ id: 201, clinic: 1, treatment: { id: 301, name: 'Routine Checkup' } }] }
      }

      if (args.collection === 'patientClinicInquiries') {
        return { docs: [makeExistingInquiry()] }
      }

      return { docs: [] }
    })

    const response = await POST(makeRequest(validBody))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true, id: 99, status: 'submitted', deduped: true })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('creates a new inquiry when an identical candidate is outside the duplicate window', async () => {
    mockSuccessfulLookupsWithInquiries([
      makeExistingInquiry({
        createdAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      }),
    ])

    const response = await POST(makeRequest(validBody))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true, id: 42, status: 'submitted' })
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('creates a new inquiry when an identical candidate has an invalid timestamp', async () => {
    mockSuccessfulLookupsWithInquiries([makeExistingInquiry({ createdAt: 'not-a-date' })])

    const response = await POST(makeRequest(validBody))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true, id: 42, status: 'submitted' })
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('creates a new inquiry when the recent candidate has a different message', async () => {
    findMock.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'clinics') {
        return { docs: [{ id: 1, name: 'Berlin Health Clinic', slug: 'berlin-health', status: 'approved' }] }
      }

      if (args.collection === 'doctors') {
        return { docs: [{ id: 601, fullName: 'Dr. Ada Care', clinic: 1 }] }
      }

      if (args.collection === 'clinictreatments') {
        return { docs: [{ id: 201, clinic: 1, treatment: { id: 301, name: 'Routine Checkup' } }] }
      }

      if (args.collection === 'patientClinicInquiries') {
        return { docs: [makeExistingInquiry({ message: 'Different request details.' })] }
      }

      return { docs: [] }
    })

    const response = await POST(makeRequest(validBody))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true, id: 42, status: 'submitted' })
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('creates a new inquiry when the recent candidate has a different full name', async () => {
    findMock.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'clinics') {
        return { docs: [{ id: 1, name: 'Berlin Health Clinic', slug: 'berlin-health', status: 'approved' }] }
      }

      if (args.collection === 'doctors') {
        return { docs: [{ id: 601, fullName: 'Dr. Ada Care', clinic: 1 }] }
      }

      if (args.collection === 'clinictreatments') {
        return { docs: [{ id: 201, clinic: 1, treatment: { id: 301, name: 'Routine Checkup' } }] }
      }

      if (args.collection === 'patientClinicInquiries') {
        return { docs: [makeExistingInquiry({ fullName: 'Different Patient' })] }
      }

      return { docs: [] }
    })

    const response = await POST(makeRequest(validBody))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true, id: 42, status: 'submitted' })
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('serializes concurrent identical requests before creating a duplicate', async () => {
    let createdInquiry: Record<string, unknown> | null = null

    findMock.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'clinics') {
        return { docs: [{ id: 1, name: 'Berlin Health Clinic', slug: 'berlin-health', status: 'approved' }] }
      }

      if (args.collection === 'doctors') {
        return { docs: [{ id: 601, fullName: 'Dr. Ada Care', clinic: 1 }] }
      }

      if (args.collection === 'clinictreatments') {
        return { docs: [{ id: 201, clinic: 1, treatment: { id: 301, name: 'Routine Checkup' } }] }
      }

      if (args.collection === 'patientClinicInquiries') {
        return { docs: createdInquiry ? [createdInquiry] : [] }
      }

      return { docs: [] }
    })
    createMock.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      createdInquiry = makeExistingInquiry({
        ...args.data,
        id: 42,
        createdAt: new Date().toISOString(),
      })

      return { id: 42, status: 'submitted' }
    })

    const [firstResponse, secondResponse] = await Promise.all([
      POST(makeRequest(validBody)),
      POST(makeRequest(validBody)),
    ])
    const [firstJson, secondJson] = await Promise.all([firstResponse.json(), secondResponse.json()])

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect([firstJson, secondJson]).toContainEqual({ success: true, id: 42, status: 'submitted' })
    expect([firstJson, secondJson]).toContainEqual({ success: true, id: 42, status: 'submitted', deduped: true })
  })
})
