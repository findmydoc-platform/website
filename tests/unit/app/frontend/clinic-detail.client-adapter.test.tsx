// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  ClinicContactRequestPayload,
  ClinicContactRequestSubmitter,
  ClinicDetailData,
} from '@/features/clinicDetail/contracts'
import { ClinicContactRequestError } from '@/features/clinicDetail/contracts'

const mocks = vi.hoisted(() => ({
  clinicDetailComponent: vi.fn((_props: unknown) => null),
  postHogBrowserEvents: {
    clinicCtaClicked: vi.fn(),
    clinicProfileViewed: vi.fn(),
  },
}))

vi.mock('@/components/templates/ClinicDetailConcepts', () => ({
  ClinicDetail: mocks.clinicDetailComponent,
}))

vi.mock('@/posthog/client-api', () => ({
  postHogBrowserEvents: mocks.postHogBrowserEvents,
}))

import {
  ClinicDetailClientAdapter,
  submitClinicContactRequest,
} from '@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client'

const originalFetch = global.fetch

const requestPayload: ClinicContactRequestPayload = {
  clinicId: '42',
  doctorId: '7',
  idempotencyKey: 'request-key',
  message: 'Please contact me.',
  consent: true,
}

afterEach(() => {
  global.fetch = originalFetch
  vi.clearAllMocks()
})

describe('ClinicDetailClientAdapter', () => {
  it('maps domain analytics callbacks to PostHog at the route boundary', () => {
    render(<ClinicDetailClientAdapter data={{} as ClinicDetailData} />)

    const componentProps = mocks.clinicDetailComponent.mock.calls.at(0)?.[0] as
      | {
          analytics?: {
            onCtaClicked: (event: Record<string, unknown>) => void
            onProfileViewed: (event: Record<string, unknown>) => void
          }
        }
      | undefined

    componentProps?.analytics?.onProfileViewed({
      clinicId: '42',
      clinicSlug: 'test-clinic',
      hasDoctors: true,
      hasTreatments: false,
      pagePath: '/clinics/test-clinic',
      verificationTier: 'silver',
    })
    componentProps?.analytics?.onCtaClicked({
      clinicId: '42',
      clinicSlug: 'test-clinic',
      ctaId: 'contact_doctor',
      ctaLabel: 'Contact Doctor',
      ctaLocation: 'doctor_card',
      doctorId: '7',
      pagePath: '/clinics/test-clinic',
    })

    expect(mocks.postHogBrowserEvents.clinicProfileViewed).toHaveBeenCalledWith({
      clinic_id: '42',
      clinic_slug: 'test-clinic',
      has_doctors: true,
      has_treatments: false,
      page_path: '/clinics/test-clinic',
      source_route: 'clinic_detail',
      verification_tier: 'silver',
    })
    expect(mocks.postHogBrowserEvents.clinicCtaClicked).toHaveBeenCalledWith({
      clinic_id: '42',
      clinic_slug: 'test-clinic',
      cta_id: 'contact_doctor',
      cta_label: 'Contact Doctor',
      cta_location: 'doctor_card',
      doctor_id: '7',
      page_path: '/clinics/test-clinic',
      source_route: 'clinic_detail',
    })
  })

  it.each([
    [false, '/api/clinic-contact-requests', { id: 42 }],
    [true, '/api/patient/inquiries', { inquiry: { id: 43 } }],
  ])('submits through the route-owned endpoint for authenticated=%s', async (authenticated, endpoint, responseBody) => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    global.fetch = fetchMock

    render(<ClinicDetailClientAdapter data={{} as ClinicDetailData} />)

    const componentProps = mocks.clinicDetailComponent.mock.calls.at(0)?.[0] as
      { onSubmitContactRequest?: ClinicContactRequestSubmitter } | undefined
    const submitContactRequest = componentProps?.onSubmitContactRequest

    expect(submitContactRequest).toBeTypeOf('function')
    if (!submitContactRequest) return

    await expect(submitContactRequest(requestPayload, authenticated)).resolves.toEqual({
      id: authenticated ? '43' : '42',
    })
    expect(fetchMock).toHaveBeenCalledWith(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    })
  })

  it('marks an expired patient session for reauthentication', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: 'INQUIRY_UNAUTHORIZED' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    const result = submitClinicContactRequest(requestPayload, true)

    await expect(result).rejects.toMatchObject({
      message: 'Your session has ended. Sign in again before sending this request.',
      requiresReauthentication: true,
    } satisfies Partial<ClinicContactRequestError>)
  })

  it('preserves a string domain error without forcing reauthentication', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'Doctor is not available for this clinic.' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    const result = submitClinicContactRequest(requestPayload, false)

    await expect(result).rejects.toMatchObject({
      message: 'Doctor is not available for this clinic.',
      requiresReauthentication: false,
    } satisfies Partial<ClinicContactRequestError>)
  })

  it('rejects a successful response that cannot identify the created request', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    const result = submitClinicContactRequest(requestPayload, false)

    await expect(result).rejects.toMatchObject({
      message: 'Could not confirm your clinic request.',
      requiresReauthentication: false,
    } satisfies Partial<ClinicContactRequestError>)
  })
})
