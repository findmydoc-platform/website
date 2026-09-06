// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ClinicDetailClientAdapter } from '@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'

vi.mock('@/posthog/client-api', () => ({
  postHogBrowserEvents: {
    clinicCtaClicked: vi.fn(),
    clinicProfileViewed: vi.fn(),
  },
}))

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.clearAllMocks()
})

describe('ClinicDetailClientAdapter flow', () => {
  it('shows an expired-session response from the route adapter in the real contact form', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: 'INQUIRY_UNAUTHORIZED' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    render(
      <ClinicDetailClientAdapter
        data={clinicDetailFixture}
        inquiryCreation={{
          kind: 'authenticated',
          loginHref: '/login/patient?next=%2Fclinics%2Fberlin-health-clinic',
          account: {
            email: 'ada@example.com',
            firstName: 'Ada',
            lastName: 'Lovelace',
            phoneNumber: '+49 30 123456',
          },
        }}
      />,
    )

    const form = screen.getByRole('form', { name: 'Clinic appointment request' })
    const contactForm = within(form)
    fireEvent.change(contactForm.getByRole('combobox', { name: 'Doctor' }), { target: { value: 'doctor-1' } })
    fireEvent.change(contactForm.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Please contact me.' },
    })
    fireEvent.click(contactForm.getByRole('checkbox'))
    fireEvent.click(contactForm.getByRole('button', { name: 'Submit Contact Request' }))

    expect(
      await contactForm.findByText('Your session has ended. Sign in again before sending this request.'),
    ).toBeInTheDocument()
    expect(contactForm.getByRole('link', { name: 'Sign in again' })).toHaveAttribute(
      'href',
      '/login/patient?next=%2Fclinics%2Fberlin-health-clinic',
    )
    expect(contactForm.getByRole('button', { name: 'Submit Contact Request' })).toBeDisabled()
    expect(global.fetch).toHaveBeenCalledWith('/api/patient/inquiries', expect.objectContaining({ method: 'POST' }))
  })
})
