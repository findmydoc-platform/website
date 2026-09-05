// @vitest-environment jsdom
import * as React from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContactFormFields } from '@/components/organisms/ClinicDetail/types'
import { useClinicDetailInteractionState } from '@/components/templates/ClinicDetailConcepts/hooks/useClinicDetailInteractionState'
import {
  ClinicContactRequestError,
  type ClinicContactRequestSubmitter,
  type ClinicDetailDoctor,
  type ClinicDetailTreatment,
} from '@/features/clinicDetail/contracts'

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

const submitClinicContactRequest = vi.fn<ClinicContactRequestSubmitter>()

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
      onSubmitContactRequest: submitClinicContactRequest,
    }),
  )
}

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>
}

describe('useClinicDetailInteractionState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitClinicContactRequest.mockResolvedValue({ id: '42' })
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
    expect(submitClinicContactRequest).toHaveBeenCalledTimes(1)
    const firstPayload = submitClinicContactRequest.mock.calls[0]?.[0]
    expect(firstPayload?.idempotencyKey).toMatch(/\S{8,}/u)

    await act(async () => {
      await result.current.handleContactSubmit(submitEvent())
    })

    expect(submitClinicContactRequest).toHaveBeenCalledTimes(1)
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

    expect(submitClinicContactRequest).toHaveBeenCalledTimes(1)
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

    expect(submitClinicContactRequest).toHaveBeenCalledTimes(2)
    const firstPayload = submitClinicContactRequest.mock.calls[0]?.[0]
    const secondPayload = submitClinicContactRequest.mock.calls[1]?.[0]
    expect(secondPayload?.idempotencyKey).not.toBe(firstPayload?.idempotencyKey)
  })

  it('reuses the same request key when an unchanged failed submission is retried', async () => {
    submitClinicContactRequest
      .mockRejectedValueOnce(new Error('Temporary failure.'))
      .mockResolvedValueOnce({ id: '42' })
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

    const firstPayload = submitClinicContactRequest.mock.calls[0]?.[0]
    const secondPayload = submitClinicContactRequest.mock.calls[1]?.[0]
    expect(secondPayload?.idempotencyKey).toBe(firstPayload?.idempotencyKey)
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

    expect(submitClinicContactRequest).toHaveBeenCalledWith(expect.any(Object), true)
    const requestPayload = submitClinicContactRequest.mock.calls[0]?.[0]
    expect(requestPayload).not.toHaveProperty('actorId')
    expect(requestPayload).not.toHaveProperty('patientId')
    expect(requestPayload).not.toHaveProperty('email')
    expect(requestPayload).not.toHaveProperty('fullName')
    expect(requestPayload).not.toHaveProperty('phoneNumber')
    expect(requestPayload?.clinicId).toBe('1')
    expect(result.current.submittedInquiryHref).toBe('/patient/inquiries/42')
    expect(result.current.isPhoneLocked).toBe(true)
  })

  it('stops after a 401 and exposes reauthentication state', async () => {
    submitClinicContactRequest.mockRejectedValueOnce(
      new ClinicContactRequestError('Your session has ended. Sign in again before sending this request.', true),
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
