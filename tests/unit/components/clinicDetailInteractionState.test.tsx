// @vitest-environment jsdom
import * as React from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContactFormFields } from '@/components/organisms/ClinicDetail/types'
import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'
import { useClinicDetailInteractionState } from '@/components/templates/ClinicDetailConcepts/hooks/useClinicDetailInteractionState'

const initialContactFormFields: ContactFormFields = {
  firstName: 'Jane',
  lastName: 'Patient',
  phoneNumber: '+49 30 123456',
  email: 'jane.patient@example.com',
  treatmentTimeline: 'within_two_weeks',
  preferredContactWindow: 'morning',
  note: 'I would like to discuss treatment options.',
  consentAccepted: true,
}

const doctors: ClinicDetailDoctor[] = [
  {
    id: '601',
    name: 'Dr. Ada Care',
    specialty: 'Dermatology',
    image: { src: '/doctor.jpg', alt: 'Dr. Ada Care' },
    contactHref: '#contact-clinic',
  },
]

const treatments: ClinicDetailTreatment[] = [
  {
    id: '301',
    name: 'Routine Checkup',
  },
]

function renderInteractionState(
  inquiryCreation: Parameters<typeof useClinicDetailInteractionState>[0]['inquiryCreation'] = { kind: 'guest' },
) {
  return renderHook(() =>
    useClinicDetailInteractionState({
      clinicId: 1,
      clinicSlug: 'berlin-health',
      doctors,
      heroDoctors: doctors,
      sortedTreatments: treatments,
      initialContactFormFields,
      inquiryCreation,
      furtherTreatmentPageSize: 4,
    }),
  )
}

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>
}

describe('useClinicDetailInteractionState', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, id: 42, status: 'submitted' }),
      }),
    )
  })

  it('keeps a successful contact request in sent state and ignores a repeated submit', async () => {
    const { result } = renderInteractionState()

    act(() => {
      result.current.handleDoctorSelectionChange('601')
    })

    await act(async () => {
      await result.current.handleContactSubmit(submitEvent())
    })

    expect(result.current.hasSubmittedContact).toBe(true)
    expect(result.current.contactFormMessage).toBe('Your clinic request has been sent successfully.')
    expect(fetch).toHaveBeenCalledTimes(1)
    const firstRequest = vi.mocked(fetch).mock.calls[0]?.[1]
    const firstBody = JSON.parse(String(firstRequest?.body)) as { idempotencyKey?: string }
    expect(firstBody.idempotencyKey).toMatch(/\S{8,}/u)

    await act(async () => {
      await result.current.handleContactSubmit(submitEvent())
    })

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ignores two immediate submit events before React rerenders the submitting state', async () => {
    const { result } = renderInteractionState()

    act(() => {
      result.current.handleDoctorSelectionChange('601')
    })

    await act(async () => {
      const firstSubmit = result.current.handleContactSubmit(submitEvent())
      const secondSubmit = result.current.handleContactSubmit(submitEvent())
      await Promise.all([firstSubmit, secondSubmit])
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.current.hasSubmittedContact).toBe(true)
  })

  it('allows a new submit after the requester changes a field', async () => {
    const { result } = renderInteractionState()

    act(() => {
      result.current.handleDoctorSelectionChange('601')
    })

    await act(async () => {
      await result.current.handleContactSubmit(submitEvent())
    })

    act(() => {
      result.current.handleContactFieldChange('note', 'I have an updated request.')
    })

    expect(result.current.hasSubmittedContact).toBe(false)

    await act(async () => {
      await result.current.handleContactSubmit(submitEvent())
    })

    expect(fetch).toHaveBeenCalledTimes(2)
    const firstBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { idempotencyKey: string }
    const secondBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)) as { idempotencyKey: string }
    expect(secondBody.idempotencyKey).not.toBe(firstBody.idempotencyKey)
  })

  it('reuses the same request key when an unchanged failed submission is retried', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Temporary failure.' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
    const { result } = renderInteractionState()

    act(() => {
      result.current.handleDoctorSelectionChange('601')
    })
    await act(async () => {
      await result.current.handleContactSubmit(submitEvent())
    })
    await act(async () => {
      await result.current.handleContactSubmit(submitEvent())
    })

    const firstBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { idempotencyKey: string }
    const secondBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)) as { idempotencyKey: string }
    expect(secondBody.idempotencyKey).toBe(firstBody.idempotencyKey)
  })

  it('uses the authenticated patient endpoint without sending browser identity fields', async () => {
    const { result } = renderInteractionState({
      kind: 'authenticated',
      loginHref: '/login/patient?next=%2Fclinics%2Fberlin-health',
      account: {
        email: 'account.patient@example.com',
        firstName: 'Account',
        lastName: 'Patient',
        phoneNumber: '+49 30 999999',
      },
    })

    act(() => {
      result.current.handleDoctorSelectionChange('601')
    })
    await act(async () => {
      await result.current.handleContactSubmit(submitEvent())
    })

    expect(fetch).toHaveBeenCalledWith('/api/patient/inquiries', expect.anything())
    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(requestBody).not.toHaveProperty('actorId')
    expect(requestBody).not.toHaveProperty('patientId')
    expect(requestBody).not.toHaveProperty('email')
    expect(requestBody).not.toHaveProperty('fullName')
    expect(requestBody).not.toHaveProperty('phoneNumber')
    expect(result.current.submittedInquiryHref).toBe('/patient/inquiries/42')
    expect(result.current.isPhoneLocked).toBe(true)
  })

  it('stops after a 401 and exposes reauthentication state', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'INQUIRY_UNAUTHORIZED' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const { result } = renderInteractionState({
      kind: 'authenticated',
      loginHref: '/login/patient?next=%2Fclinics%2Fberlin-health',
      account: {
        email: 'account.patient@example.com',
        firstName: 'Account',
        lastName: 'Patient',
        phoneNumber: '+49 30 999999',
      },
    })
    act(() => {
      result.current.handleDoctorSelectionChange('601')
    })

    await act(async () => {
      await result.current.handleContactSubmit(submitEvent())
    })

    expect(result.current.requiresReauthentication).toBe(true)
    expect(result.current.hasSubmittedContact).toBe(false)
    expect(result.current.contactFormMessage).toBe('Your session has ended. Sign in again before sending this request.')
  })
})
