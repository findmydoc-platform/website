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

const turkeyCountry = { id: 1, name: 'Turkey', isoCode: 'TR' }
let cityDocs: Array<{ id: number; name: string; country: number }> = [{ id: 10, name: 'Istanbul', country: 1 }]

const findMock = vi.fn()
const createMock = vi.fn().mockResolvedValue({ id: 123 })
const loggerMock = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

const getWhereEquals = (where: unknown, key: string): unknown => {
  if (!where || typeof where !== 'object') {
    return undefined
  }

  const record = where as Record<string, unknown>
  const direct = record[key]
  if (direct && typeof direct === 'object' && 'equals' in direct) {
    return (direct as { equals?: unknown }).equals
  }

  const andConditions = record.and
  if (Array.isArray(andConditions)) {
    for (const condition of andConditions) {
      const match = getWhereEquals(condition, key)
      if (match !== undefined) {
        return match
      }
    }
  }

  return undefined
}

const mockPayloadFind = async ({ collection, where }: { collection?: string; where?: unknown }) => {
  if (collection === 'countries') {
    return { docs: [turkeyCountry] }
  }

  if (collection === 'cities') {
    const cityId = String(getWhereEquals(where, 'id') ?? '')
    const countryId = Number(getWhereEquals(where, 'country'))

    return {
      docs: cityDocs.filter((city) => String(city.id) === cityId && city.country === countryId),
    }
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
    cityDocs = [{ id: 10, name: 'Istanbul', country: 1 }]
    findMock.mockImplementation(mockPayloadFind)
    createMock.mockResolvedValue({ id: 123 })
    postHogMocks.resolveAnonymousPostHogActor.mockReturnValue(postHogMocks.actor)
    postHogMocks.resolveAnalyticsConsent.mockResolvedValue(postHogMocks.analyticsConsent)
  })

  test('returns 400 and skips create for invalid zipCode', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: '12A45',
        city: 'Istanbul',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid zipCode')
    expect(createMock).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })

  test('creates application with an existing Turkey city id', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Should be replaced',
        cityId: '10',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.id).toBeDefined()
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clinicApplications',
        data: expect.objectContaining({
          address: expect.objectContaining({
            city: 'Istanbul',
            country: 'Turkey',
          }),
        }),
      }),
    )
  })

  test('creates application success and tracks a privacy-safe submission event', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        contactPhone: '+90 555 123',
        additionalNotes: 'Please contact us soon.',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Istanbul',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.id).toBeDefined()
    expect(postHogMocks.resolveAnonymousPostHogActor).toHaveBeenCalledWith({
      fallbackAnonymousId: 'clinic_registration:123',
      headers: expect.any(Headers),
    })
    expect(postHogMocks.registerClinicSubmitted).toHaveBeenCalledWith({
      actor: postHogMocks.actor,
      analyticsConsent: postHogMocks.analyticsConsent,
      flush: true,
      properties: {
        country: 'Turkey',
        has_additional_notes: true,
        has_contact_phone: true,
        source_route: 'clinic_registration',
        submission_status: 'created',
      },
    })
    expect(postHogMocks.registerClinicSubmitted.mock.calls[0]?.[0]?.properties).not.toHaveProperty('contactEmail')
    expect(postHogMocks.registerClinicSubmitted.mock.calls[0]?.[0]?.properties).not.toHaveProperty('contactPhone')
  })

  test('dedupes an existing application and tracks a dedupe event', async () => {
    findMock.mockResolvedValueOnce({ docs: [{ id: 456 }] })

    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Istanbul',
        country: 'Turkey',
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(202)
    expect(json).toEqual({ success: true, id: 456, dedupe: true })
    expect(createMock).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).toHaveBeenCalledWith({
      actor: postHogMocks.actor,
      analyticsConsent: postHogMocks.analyticsConsent,
      flush: true,
      properties: {
        country: 'Turkey',
        has_additional_notes: false,
        has_contact_phone: false,
        source_route: 'clinic_registration',
        submission_status: 'deduped',
      },
    })
  })

  test('creates application with a custom Turkey city and default country', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Mersin',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          address: expect.objectContaining({
            city: 'Mersin',
            country: 'Turkey',
          }),
        }),
      }),
    )
    expect(postHogMocks.registerClinicSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          country: 'Turkey',
          submission_status: 'created',
        }),
      }),
    )
  })

  test('rejects explicit non-Turkey country values', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Berlin',
        country: 'Germany',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('Clinic registrations are currently limited to Turkey')
    expect(createMock).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })

  test('rejects unexpected free-text country values before PostHog capture', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Istanbul',
        country: 'alice@example.com',
      }),
    )

    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })

  test('accepts custom city text without checking it against a city allowlist', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Berlin',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          address: expect.objectContaining({
            city: 'Berlin',
            country: 'Turkey',
          }),
        }),
      }),
    )
  })

  test('rejects invalid city ids', async () => {
    cityDocs = []

    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        cityId: '999',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('City is not available for Turkey')
    expect(createMock).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })

  test('rejects city ids outside Turkey', async () => {
    cityDocs = [{ id: 20, name: 'Berlin', country: 2 }]

    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        cityId: '20',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('City is not available for Turkey')
    expect(createMock).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })

  test('creates application success and skips PostHog without analytics consent', async () => {
    postHogMocks.resolveAnalyticsConsent.mockResolvedValueOnce({ isAllowed: false })

    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Istanbul',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(postHogMocks.resolveAnonymousPostHogActor).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).not.toHaveBeenCalled()
  })
})
