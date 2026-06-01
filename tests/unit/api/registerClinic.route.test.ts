import { beforeEach, describe, test, expect, vi } from 'vitest'

const postHogMocks = vi.hoisted(() => ({
  analyticsConsent: { isAllowed: true },
  actor: {
    distinctId: 'clinic_registration:123',
    isAuthenticated: false,
    personProperties: {
      is_authenticated: 'false',
      user_type: 'anonymous',
    },
    userType: 'anonymous',
  },
  registerClinicSubmitted: vi.fn(),
  resolveAnonymousPostHogActor: vi.fn(),
  resolveAnalyticsConsent: vi.fn(),
}))

const topLevelSpecialties = [
  { id: 1, name: 'Dental', parentSpecialty: null },
  { id: 2, name: 'Eye Care', parentSpecialty: null },
  { id: 3, name: 'Hair Restoration', parentSpecialty: null },
]
const childSpecialty = { id: 11, name: 'Implants', parentSpecialty: 1 }

let existingClinicApplications: Array<{ id: number }> = []

const findMock = vi.fn()
const createMock = vi.fn().mockResolvedValue({ id: 123 })
const loggerMock = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

const mockPayloadFind = async ({ collection }: { collection?: string }) => {
  if (collection === 'medical-specialties') {
    return { docs: [...topLevelSpecialties, childSpecialty] }
  }

  if (collection === 'clinicApplications') {
    return { docs: existingClinicApplications }
  }

  return { docs: [] }
}

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()

  return {
    ...actual,
    buildConfig: (cfg: unknown) => cfg,
    getPayload: async () => ({
      find: findMock,
      create: createMock,
      logger: loggerMock,
    }),
  }
})

vi.mock('@/posthog/api', () => ({
  postHogServerConsent: {
    resolveAnalyticsConsent: postHogMocks.resolveAnalyticsConsent,
  },
  postHogServerEvents: {
    registerClinicSubmitted: postHogMocks.registerClinicSubmitted,
  },
  resolveAnonymousPostHogActor: postHogMocks.resolveAnonymousPostHogActor,
}))

import { POST } from '@/app/api/auth/register/clinic/route'
import { NextRequest } from 'next/server'

const validSubmission = {
  clinicName: 'New Clinic',
  clinicWebsite: 'new-clinic.example',
  contactName: 'Dr. Ada Lovelace',
  contactEmail: 'clinic@example.com',
  contactRole: 'Clinic Management',
  medicalSpecialties: ['1', '3'],
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/register/clinic', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth/register/clinic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existingClinicApplications = []
    findMock.mockImplementation(mockPayloadFind)
    createMock.mockResolvedValue({ id: 123 })
    postHogMocks.resolveAnonymousPostHogActor.mockReturnValue(postHogMocks.actor)
    postHogMocks.resolveAnalyticsConsent.mockResolvedValue(postHogMocks.analyticsConsent)
  })

  test('creates a clinic application from the funnel payload', async () => {
    const res = await POST(makeRequest(validSubmission))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.id).toBe(123)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clinicApplications',
        data: expect.objectContaining({
          clinicName: 'New Clinic',
          clinicWebsite: 'https://new-clinic.example/',
          contactFirstName: null,
          contactLastName: 'Dr. Ada Lovelace',
          contactEmail: 'clinic@example.com',
          contactRole: 'Clinic Management',
          medicalSpecialties: [1, 3],
          status: 'submitted',
          privacyNotice: expect.objectContaining({
            acknowledgedAt: expect.any(String),
            url: '/privacy-policy',
          }),
        }),
        overrideAccess: true,
      }),
    )
    expect(createMock.mock.calls[0]?.[0]?.data).not.toHaveProperty('websiteOrPublicProfile')
    expect(createMock.mock.calls[0]?.[0]?.data).not.toHaveProperty('contactPhone')
    expect(createMock.mock.calls[0]?.[0]?.data).not.toHaveProperty('address')
    expect(createMock.mock.calls[0]?.[0]?.data).not.toHaveProperty('additionalNotes')
  })

  test('tracks a privacy-safe submission event', async () => {
    const res = await POST(makeRequest(validSubmission))

    expect(res.status).toBe(200)
    expect(postHogMocks.resolveAnonymousPostHogActor).toHaveBeenCalledWith({
      fallbackAnonymousId: 'clinic_registration:123',
      headers: expect.any(Headers),
    })
    expect(postHogMocks.registerClinicSubmitted).toHaveBeenCalledWith({
      actor: postHogMocks.actor,
      analyticsConsent: postHogMocks.analyticsConsent,
      flush: true,
      properties: {
        medical_specialty_count: 2,
        source_route: 'clinic_registration',
        submission_status: 'created',
      },
    })
    expect(postHogMocks.registerClinicSubmitted.mock.calls[0]?.[0]?.properties).not.toHaveProperty('contactEmail')
    expect(postHogMocks.registerClinicSubmitted.mock.calls[0]?.[0]?.properties).not.toHaveProperty('clinicName')
  })

  test('dedupes an existing submitted application and tracks a dedupe event', async () => {
    existingClinicApplications = [{ id: 456 }]

    const res = await POST(makeRequest(validSubmission))
    const json = await res.json()

    expect(res.status).toBe(202)
    expect(json).toEqual({ success: true, id: 456, dedupe: true })
    expect(createMock).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          medical_specialty_count: 2,
          submission_status: 'deduped',
        }),
      }),
    )
  })

  test('creates application success and skips PostHog without analytics consent', async () => {
    postHogMocks.resolveAnalyticsConsent.mockResolvedValueOnce({ isAllowed: false })

    const res = await POST(makeRequest(validSubmission))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(postHogMocks.resolveAnonymousPostHogActor).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })

  test('rejects invalid clinicWebsite values', async () => {
    const res = await POST(
      makeRequest({
        ...validSubmission,
        clinicWebsite: 'not-a-url',
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid clinicWebsite')
    expect(createMock).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })

  test('rejects invalid contactEmail values', async () => {
    const res = await POST(
      makeRequest({
        ...validSubmission,
        contactEmail: 'not-an-email',
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid contactEmail')
    expect(createMock).not.toHaveBeenCalled()
  })

  test('rejects invalid contactRole values', async () => {
    const res = await POST(
      makeRequest({
        ...validSubmission,
        contactRole: 'Owner',
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid contactRole')
    expect(createMock).not.toHaveBeenCalled()
  })

  test('rejects missing medicalSpecialties values', async () => {
    const res = await POST(
      makeRequest({
        ...validSubmission,
        medicalSpecialties: [],
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid medicalSpecialties')
    expect(createMock).not.toHaveBeenCalled()
  })

  test('rejects medicalSpecialties that do not exist', async () => {
    const res = await POST(
      makeRequest({
        ...validSubmission,
        medicalSpecialties: ['999'],
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid medicalSpecialties')
    expect(createMock).not.toHaveBeenCalled()
  })

  test('rejects non-top-level medicalSpecialties', async () => {
    const res = await POST(
      makeRequest({
        ...validSubmission,
        medicalSpecialties: ['11'],
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid medicalSpecialties')
    expect(createMock).not.toHaveBeenCalled()
  })
})
