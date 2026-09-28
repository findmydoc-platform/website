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

const serviceMocks = vi.hoisted(() => ({ submit: vi.fn() }))

const topLevelSpecialties = [
  { id: 1, name: 'Dental', parentSpecialty: null },
  { id: 2, name: 'Eye Care', parentSpecialty: null },
  { id: 3, name: 'Hair Restoration', parentSpecialty: null },
]
const childSpecialty = { id: 11, name: 'Implants', parentSpecialty: 1 }

let existingClinicApplications: Array<{ id: number }> = []

const findMock = vi.fn()
const loggerMock = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
const publicReq = { kind: 'public-request' }

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
    createLocalReq: async () => publicReq,
    getPayload: async () => ({
      find: findMock,
      logger: loggerMock,
    }),
  }
})

vi.mock('@/features/clinicRegistration/service', () => ({
  ClinicRegistrationSubmissionError: class ClinicRegistrationSubmissionError extends Error {
    readonly code = 'clinic-registration-unavailable'
  },
  submitClinicRegistration: serviceMocks.submit,
}))

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
import { TransactionalEmailError } from '@/features/transactionalEmail'
import { NextRequest } from 'next/server'

const validSubmission = {
  clinicName: 'New Clinic',
  clinicWebsite: 'new-clinic.example',
  contactFirstName: 'Ada',
  contactLastName: 'Lovelace',
  contactEmail: 'clinic@example.com',
  contactRole: 'Clinic Management',
  medicalSpecialties: ['1', '3'],
}
const websitePrefix = 'https://example.com/'
const maximumLengthEmail = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`
const tooLongEmail = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`
const maximumLengthWebsite = websitePrefix + 'w'.repeat(2048 - websitePrefix.length)
const tooLongWebsite = websitePrefix + 'w'.repeat(2049 - websitePrefix.length)

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/register/clinic', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeRawRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/auth/register/clinic', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function paddedSubmissionBody(byteLength: number): string {
  const emptyBody = JSON.stringify({ ...validSubmission, padding: '' })
  const emptyBodyByteLength = new TextEncoder().encode(emptyBody).byteLength
  return JSON.stringify({ ...validSubmission, padding: 'x'.repeat(byteLength - emptyBodyByteLength) })
}

describe('POST /api/auth/register/clinic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existingClinicApplications = []
    findMock.mockImplementation(mockPayloadFind)
    serviceMocks.submit.mockResolvedValue({ applicationId: 123, created: true })
    postHogMocks.resolveAnonymousPostHogActor.mockReturnValue(postHogMocks.actor)
    postHogMocks.resolveAnalyticsConsent.mockResolvedValue(postHogMocks.analyticsConsent)
  })

  test('creates a clinic application from the funnel payload', async () => {
    const res = await POST(makeRequest(validSubmission))
    const json = await res.json()

    expect(res.status).toBe(202)
    expect(json).toEqual({ success: true })
    expect(serviceMocks.submit).toHaveBeenCalledWith(publicReq, {
      clinicName: 'New Clinic',
      clinicWebsite: 'https://new-clinic.example/',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
      contactEmail: 'clinic@example.com',
      contactRole: 'Clinic Management',
      medicalSpecialtyIds: [1, 3],
      sourceMeta: { ip: '', userAgent: '' },
    })
    const submittedInput = serviceMocks.submit.mock.calls[0]?.[1]
    expect(submittedInput).not.toHaveProperty('websiteOrPublicProfile')
    expect(submittedInput).not.toHaveProperty('contactPhone')
    expect(submittedInput).not.toHaveProperty('address')
    expect(submittedInput).not.toHaveProperty('additionalNotes')
  })

  test('accepts the documented request and field boundaries', async () => {
    const specialties = Array.from({ length: 25 }, (_, index) => index + 1)
    findMock.mockResolvedValueOnce({
      docs: specialties.map((id) => ({ id, name: `Specialty ${id}`, parentSpecialty: null })),
    })

    const response = await POST(
      makeRequest({
        clinicName: 'C'.repeat(160),
        clinicWebsite: maximumLengthWebsite,
        contactFirstName: 'F'.repeat(100),
        contactLastName: 'L'.repeat(100),
        contactEmail: maximumLengthEmail,
        contactRole: 'Clinic Management',
        medicalSpecialties: specialties,
      }),
    )

    expect(response.status).toBe(202)
    expect(serviceMocks.submit).toHaveBeenCalledWith(
      publicReq,
      expect.objectContaining({
        clinicName: 'C'.repeat(160),
        clinicWebsite: maximumLengthWebsite,
        contactFirstName: 'F'.repeat(100),
        contactLastName: 'L'.repeat(100),
        contactEmail: maximumLengthEmail,
        medicalSpecialtyIds: specialties,
      }),
    )
  })

  test('accepts a request body of exactly 32 KiB', async () => {
    const body = paddedSubmissionBody(32 * 1024)

    expect(new TextEncoder().encode(body)).toHaveLength(32 * 1024)
    const response = await POST(makeRawRequest(body))

    expect(response.status).toBe(202)
    expect(serviceMocks.submit).toHaveBeenCalledOnce()
  })

  test('rejects a request body larger than 32 KiB before persistence', async () => {
    const response = await POST(makeRawRequest(paddedSubmissionBody(32 * 1024 + 1)))

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({ error: 'Request body too large' })
    expect(findMock).not.toHaveBeenCalled()
    expect(serviceMocks.submit).not.toHaveBeenCalled()
  })

  test('rejects a simple cross-origin content type before persistence', async () => {
    const response = await POST(makeRawRequest(JSON.stringify(validSubmission), { 'Content-Type': 'text/plain' }))

    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toEqual({ error: 'Unsupported media type' })
    expect(findMock).not.toHaveBeenCalled()
    expect(serviceMocks.submit).not.toHaveBeenCalled()
  })

  test('rejects a foreign browser origin before persistence', async () => {
    const response = await POST(
      makeRawRequest(JSON.stringify(validSubmission), {
        Origin: 'https://attacker.example',
        'Sec-Fetch-Site': 'cross-site',
      }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Cross-origin request forbidden' })
    expect(findMock).not.toHaveBeenCalled()
    expect(serviceMocks.submit).not.toHaveBeenCalled()
  })

  test.each([
    ['clinicName', 'C'.repeat(161), 'Invalid clinicName', 160],
    ['contactFirstName', 'F'.repeat(101), 'Invalid contactFirstName', 100],
    ['contactLastName', 'L'.repeat(101), 'Invalid contactLastName', 100],
    ['contactEmail', tooLongEmail, 'Invalid contactEmail', 254],
    ['clinicWebsite', tooLongWebsite, 'Invalid clinicWebsite', 2048],
  ])('rejects %s values at limit + 1', async (field, value, error, maximumLength) => {
    expect(value).toHaveLength(maximumLength + 1)
    const response = await POST(makeRequest({ ...validSubmission, [field]: value }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error })
    expect(findMock).not.toHaveBeenCalled()
    expect(serviceMocks.submit).not.toHaveBeenCalled()
  })

  test('rejects more than 25 medical specialty IDs before lookup', async () => {
    const response = await POST(
      makeRequest({ ...validSubmission, medicalSpecialties: Array.from({ length: 26 }, (_, index) => index + 1) }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid medicalSpecialties' })
    expect(findMock).not.toHaveBeenCalled()
    expect(serviceMocks.submit).not.toHaveBeenCalled()
  })

  test('tracks a privacy-safe submission event', async () => {
    const res = await POST(makeRequest(validSubmission))

    expect(res.status).toBe(202)
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

  test('delegates duplicate decisions to the transactional registration service', async () => {
    existingClinicApplications = [{ id: 456 }]

    const res = await POST(makeRequest(validSubmission))
    const json = await res.json()

    expect(res.status).toBe(202)
    expect(json).toEqual({ success: true })
    expect(serviceMocks.submit).toHaveBeenCalledOnce()
    expect(findMock.mock.calls.map(([options]) => options.collection)).toEqual(['medical-specialties'])
  })

  test('does not track a reused submission as newly created', async () => {
    serviceMocks.submit.mockResolvedValue({ applicationId: 456, created: false })

    const res = await POST(makeRequest(validSubmission))

    expect(res.status).toBe(202)
    expect(postHogMocks.resolveAnalyticsConsent).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })

  test('creates application success and skips PostHog without analytics consent', async () => {
    postHogMocks.resolveAnalyticsConsent.mockResolvedValueOnce({ isAllowed: false })

    const res = await POST(makeRequest(validSubmission))
    const json = await res.json()

    expect(res.status).toBe(202)
    expect(json).toEqual({ success: true })
    expect(postHogMocks.resolveAnonymousPostHogActor).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })

  test('does not run analytics before the durable transaction succeeds', async () => {
    let releaseTransaction!: () => void
    let transactionCompleted!: () => void
    const held = new Promise<void>((resolve) => {
      releaseTransaction = resolve
    })
    const completed = new Promise<void>((resolve) => {
      transactionCompleted = resolve
    })
    serviceMocks.submit.mockImplementationOnce(async () => {
      transactionCompleted()
      await held
      return { applicationId: 123, created: true }
    })

    const responsePromise = POST(makeRequest(validSubmission))
    try {
      await completed
      expect(postHogMocks.resolveAnalyticsConsent).not.toHaveBeenCalled()
      expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
    } finally {
      releaseTransaction()
    }

    const response = await responsePromise
    expect(response.status).toBe(202)
    expect(postHogMocks.registerClinicSubmitted).toHaveBeenCalledOnce()
  })

  test('keeps durable success when analytics fails', async () => {
    postHogMocks.registerClinicSubmitted.mockRejectedValueOnce(new Error('private analytics detail'))

    const response = await POST(makeRequest(validSubmission))

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(loggerMock.warn).toHaveBeenCalledWith(
      { applicationId: 123 },
      'Clinic registration analytics failed after durable submission',
    )
  })

  test.each(['unsupported-command', 'access-denied', 'storage-unavailable', 'transaction-conflict'] as const)(
    'returns one retryable public failure for %s',
    async (code) => {
      serviceMocks.submit.mockRejectedValueOnce(new TransactionalEmailError(code))

      const response = await POST(makeRequest(validSubmission))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
        error: 'Clinic registration could not be completed. Please try again.',
      })
      expect(postHogMocks.resolveAnalyticsConsent).not.toHaveBeenCalled()
      expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
    },
  )

  test.each([
    ['plain non-url text', 'not-a-url'],
    ['bare localhost', 'localhost'],
    ['localhost URL with port and path', 'https://localhost:3000/partners/clinics'],
    ['IPv4 loopback URL', 'http://127.0.0.1:3000/path'],
    ['bare IPv4 loopback', '127.0.0.1'],
    ['private IPv4 10/8', '10.0.0.1'],
    ['private IPv4 172.16/12', '172.16.0.1'],
    ['private IPv4 192.168/16', '192.168.1.10'],
    ['link-local IPv4', '169.254.1.1'],
    ['IPv6 loopback URL', 'http://[::1]:3000'],
    ['local pseudo-TLD', 'clinic.local'],
    ['localhost subdomain', 'service.localhost'],
    ['protocol-relative URL', '//example.com'],
    ['credentialed URL', 'https://user:pass@example.com'],
    ['mailto-like credential smuggling', 'mailto:test@example.com'],
    ['non-HTTP protocol', 'ftp://example.com'],
    ['trailing-dot hostname', 'https://clinic.example.'],
    ['leading-dot hostname', 'https://.clinic.example'],
  ])('rejects suspicious clinicWebsite values: %s', async (_label, clinicWebsite) => {
    const res = await POST(
      makeRequest({
        ...validSubmission,
        clinicWebsite,
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid clinicWebsite')
    expect(serviceMocks.submit).not.toHaveBeenCalled()
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
    expect(serviceMocks.submit).not.toHaveBeenCalled()
  })

  test('rejects missing contactFirstName values', async () => {
    const res = await POST(
      makeRequest({
        ...validSubmission,
        contactFirstName: '',
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Contact first name is required')
    expect(serviceMocks.submit).not.toHaveBeenCalled()
  })

  test('rejects missing contactLastName values', async () => {
    const res = await POST(
      makeRequest({
        ...validSubmission,
        contactLastName: '',
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Contact last name is required')
    expect(serviceMocks.submit).not.toHaveBeenCalled()
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
    expect(serviceMocks.submit).not.toHaveBeenCalled()
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
    expect(serviceMocks.submit).not.toHaveBeenCalled()
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
    expect(serviceMocks.submit).not.toHaveBeenCalled()
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
    expect(serviceMocks.submit).not.toHaveBeenCalled()
  })
})
