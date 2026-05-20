import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const postHogMocks = vi.hoisted(() => ({
  analyticsConsent: { isAllowed: true },
  actor: {
    distinctId: 'form-submission:submission-1',
    isAuthenticated: false,
    personProperties: {
      is_authenticated: 'false',
      user_type: 'anonymous',
    },
    userType: 'anonymous',
  },
  clinicOnboardingInterestCreated: vi.fn(),
  patientInquiryCreated: vi.fn(),
  resolveAnonymousPostHogActor: vi.fn(),
  resolveAnalyticsConsent: vi.fn(),
}))

vi.mock('@/utilities/getForm', () => ({
  getForm: vi.fn(),
}))

vi.mock('@/utilities/logging/serverLogger', () => ({
  getServerLogger: vi.fn().mockResolvedValue({
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    level: 'info',
    trace: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock('@/utilities/submitForm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utilities/submitForm')>()

  return {
    ...actual,
    submitFormData: vi.fn(),
  }
})

vi.mock('@/posthog/api', () => ({
  postHogServerConsent: {
    resolveAnalyticsConsent: postHogMocks.resolveAnalyticsConsent,
  },
  postHogServerEvents: {
    clinicOnboardingInterestCreated: postHogMocks.clinicOnboardingInterestCreated,
    patientInquiryCreated: postHogMocks.patientInquiryCreated,
  },
  resolveAnonymousPostHogActor: postHogMocks.resolveAnonymousPostHogActor,
}))

import { POST } from '@/app/api/form-bridge/[slug]/route'
import { getForm } from '@/utilities/getForm'
import { FormSubmissionError, submitFormData } from '@/utilities/submitForm'

const mockedGetForm = vi.mocked(getForm)
const mockedSubmitFormData = vi.mocked(submitFormData)

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/form-bridge/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/form-bridge/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postHogMocks.resolveAnonymousPostHogActor.mockReturnValue(postHogMocks.actor)
    postHogMocks.resolveAnalyticsConsent.mockResolvedValue(postHogMocks.analyticsConsent)
  })

  it('returns 400 for invalid request payload', async () => {
    const response = await POST(makeRequest(['invalid']), { params: Promise.resolve({ slug: 'contact' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request payload')
    expect(mockedGetForm).not.toHaveBeenCalled()
    expect(postHogMocks.patientInquiryCreated).not.toHaveBeenCalled()
    expect(postHogMocks.clinicOnboardingInterestCreated).not.toHaveBeenCalled()
  })

  it('returns 404 when the form does not exist', async () => {
    mockedGetForm.mockResolvedValueOnce(null)

    const response = await POST(makeRequest({ name: 'Jane' }), { params: Promise.resolve({ slug: 'missing' }) })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Form not found')
  })

  it('returns the upstream form submission status instead of 500', async () => {
    mockedGetForm.mockResolvedValueOnce({ id: 'form-123' } as unknown as Awaited<ReturnType<typeof getForm>>)
    mockedSubmitFormData.mockRejectedValueOnce(new FormSubmissionError('Validation failed', 422))

    const response = await POST(makeRequest({ email: 'invalid' }), { params: Promise.resolve({ slug: 'contact' }) })
    const json = await response.json()

    expect(response.status).toBe(422)
    expect(json.error).toBe('Validation failed')
    expect(postHogMocks.patientInquiryCreated).not.toHaveBeenCalled()
    expect(postHogMocks.clinicOnboardingInterestCreated).not.toHaveBeenCalled()
  })

  it('returns 200 when submission succeeds', async () => {
    mockedGetForm.mockResolvedValueOnce({ id: 'form-123' } as unknown as Awaited<ReturnType<typeof getForm>>)
    mockedSubmitFormData.mockResolvedValueOnce({ id: 'submission-1' })

    const response = await POST(makeRequest({ email: 'jane@example.com' }), {
      params: Promise.resolve({ slug: 'contact' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      success: true,
      message: 'Form submitted successfully',
      data: { id: 'submission-1' },
    })
    expect(postHogMocks.patientInquiryCreated).not.toHaveBeenCalled()
    expect(postHogMocks.clinicOnboardingInterestCreated).not.toHaveBeenCalled()
  })

  it('tracks a privacy-safe patient inquiry event after a clinic detail form submission succeeds', async () => {
    mockedGetForm.mockResolvedValueOnce({ id: 'form-123' } as unknown as Awaited<ReturnType<typeof getForm>>)
    mockedSubmitFormData.mockResolvedValueOnce({ id: 'submission-1' })

    const response = await POST(
      makeRequest({
        clinic_id: '42',
        clinic_slug: 'berlin-health-clinic',
        doctor_id: 'doctor-1',
        email: 'jane@example.com',
        message: 'I need help with treatment details.',
        name: 'Jane Doe',
        phone_number: '+49 30 123',
        preferred_date: '2026-06-01',
        preferred_time: '10:00',
        source_route: 'clinic_detail',
        treatment_id: 'treatment-1',
      }),
      {
        params: Promise.resolve({ slug: 'holding-contact' }),
      },
    )

    expect(response.status).toBe(200)
    expect(postHogMocks.resolveAnonymousPostHogActor).toHaveBeenCalledWith({
      fallbackAnonymousId: 'form_submission:submission-1',
      headers: expect.any(Headers),
    })
    expect(postHogMocks.patientInquiryCreated).toHaveBeenCalledWith({
      actor: postHogMocks.actor,
      analyticsConsent: postHogMocks.analyticsConsent,
      flush: true,
      properties: {
        clinic_id: '42',
        clinic_slug: 'berlin-health-clinic',
        doctor_id: 'doctor-1',
        form_slug: 'holding-contact',
        has_doctor: true,
        has_message: true,
        has_preferred_date: true,
        has_preferred_time: true,
        has_treatment: true,
        source_route: 'clinic_detail',
        submission_id: 'submission-1',
        treatment_id: 'treatment-1',
      },
    })
    expect(postHogMocks.clinicOnboardingInterestCreated).not.toHaveBeenCalled()
  })

  it('tracks a privacy-safe clinic onboarding event after a partner form submission succeeds', async () => {
    mockedGetForm.mockResolvedValueOnce({ id: 'form-123' } as unknown as Awaited<ReturnType<typeof getForm>>)
    mockedSubmitFormData.mockResolvedValueOnce({ id: 'submission-2' })

    const response = await POST(
      makeRequest({
        contact_mode: 'full',
        email: 'clinic@example.com',
        message: 'We want to list our clinic.',
        name: 'Clinic Owner',
        page_path: '/partners/clinics',
        source_route: 'clinic_partners',
      }),
      {
        params: Promise.resolve({ slug: 'holding-contact' }),
      },
    )

    expect(response.status).toBe(200)
    expect(postHogMocks.clinicOnboardingInterestCreated).toHaveBeenCalledWith({
      actor: postHogMocks.actor,
      analyticsConsent: postHogMocks.analyticsConsent,
      flush: true,
      properties: {
        contact_mode: 'full',
        form_slug: 'holding-contact',
        has_message: true,
        page_path: '/partners/clinics',
        source_route: 'clinic_partners',
        submission_id: 'submission-2',
      },
    })
    expect(postHogMocks.patientInquiryCreated).not.toHaveBeenCalled()
  })

  it('does not track form bridge events when client-provided tracking identifiers are unsafe', async () => {
    mockedGetForm.mockResolvedValueOnce({ id: 'form-123' } as unknown as Awaited<ReturnType<typeof getForm>>)
    mockedSubmitFormData.mockResolvedValueOnce({ id: 'submission-3' })

    const response = await POST(
      makeRequest({
        clinic_id: 'alice@example.com',
        clinic_slug: '+49 30 123',
        email: 'jane@example.com',
        message: 'I need help with treatment details.',
        name: 'Jane Doe',
        phone_number: '+49 30 123',
        source_route: 'clinic_detail',
      }),
      {
        params: Promise.resolve({ slug: 'holding-contact' }),
      },
    )

    expect(response.status).toBe(200)
    expect(postHogMocks.patientInquiryCreated).not.toHaveBeenCalled()
    expect(postHogMocks.clinicOnboardingInterestCreated).not.toHaveBeenCalled()
  })

  it('does not track partner form events when the client-provided path is not allowlisted', async () => {
    mockedGetForm.mockResolvedValueOnce({ id: 'form-123' } as unknown as Awaited<ReturnType<typeof getForm>>)
    mockedSubmitFormData.mockResolvedValueOnce({ id: 'submission-4' })

    const response = await POST(
      makeRequest({
        contact_mode: 'full',
        email: 'clinic@example.com',
        message: 'We want to list our clinic.',
        name: 'Clinic Owner',
        page_path: '/partners/alice@example.com',
        source_route: 'clinic_partners',
      }),
      {
        params: Promise.resolve({ slug: 'holding-contact' }),
      },
    )

    expect(response.status).toBe(200)
    expect(postHogMocks.patientInquiryCreated).not.toHaveBeenCalled()
    expect(postHogMocks.clinicOnboardingInterestCreated).not.toHaveBeenCalled()
  })

  it('does not track form bridge events when PostHog analytics consent is missing', async () => {
    postHogMocks.resolveAnalyticsConsent.mockResolvedValueOnce({ isAllowed: false })
    mockedGetForm.mockResolvedValueOnce({ id: 'form-123' } as unknown as Awaited<ReturnType<typeof getForm>>)
    mockedSubmitFormData.mockResolvedValueOnce({ id: 'submission-5' })

    const response = await POST(
      makeRequest({
        clinic_id: '42',
        clinic_slug: 'berlin-health-clinic',
        email: 'jane@example.com',
        message: 'I need help with treatment details.',
        name: 'Jane Doe',
        phone_number: '+49 30 123',
        source_route: 'clinic_detail',
      }),
      {
        params: Promise.resolve({ slug: 'holding-contact' }),
      },
    )

    expect(response.status).toBe(200)
    expect(postHogMocks.resolveAnonymousPostHogActor).not.toHaveBeenCalled()
    expect(postHogMocks.patientInquiryCreated).not.toHaveBeenCalled()
    expect(postHogMocks.clinicOnboardingInterestCreated).not.toHaveBeenCalled()
  })
})
