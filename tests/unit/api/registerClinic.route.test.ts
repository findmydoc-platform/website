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

const findMock = vi.fn().mockResolvedValue({ docs: [] })
const createMock = vi.fn().mockResolvedValue({ id: 123 })
const loggerMock = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

// Mock payload getPayload import via dynamic module override if needed.
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()

  return {
    ...actual,
    // minimal buildConfig passthrough so importing payload.config doesn't explode
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
    findMock.mockResolvedValue({ docs: [] })
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

  test('does not send unexpected free-text country values to PostHog', async () => {
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

    expect(res.status).toBe(200)
    expect(postHogMocks.registerClinicSubmitted).toHaveBeenCalledWith({
      actor: postHogMocks.actor,
      analyticsConsent: postHogMocks.analyticsConsent,
      flush: true,
      properties: {
        country: undefined,
        has_additional_notes: false,
        has_contact_phone: false,
        source_route: 'clinic_registration',
        submission_status: 'created',
      },
    })
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
