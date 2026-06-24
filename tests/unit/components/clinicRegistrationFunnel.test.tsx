// @vitest-environment jsdom
import { StrictMode } from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ClinicRegistrationFunnel } from '@/components/templates/ClinicRegistrationFunnel'

vi.mock('@/auth/utilities/clinicRegistrationSubmission', () => ({
  submitClinicRegistration: vi.fn(),
}))

describe('ClinicRegistrationFunnel focus management', () => {
  it('does not focus the first step heading during the initial StrictMode render', () => {
    render(
      <StrictMode>
        <ClinicRegistrationFunnel variant="landing" />
      </StrictMode>,
    )

    expect(document.activeElement).not.toBe(screen.getByRole('heading', { name: 'Register your clinic' }))
  })

  it('focuses the active step heading after an explicit step change', async () => {
    render(
      <StrictMode>
        <ClinicRegistrationFunnel
          initialValues={{
            clinicName: 'Demo Clinic',
            clinicWebsite: 'https://clinic.example',
          }}
          variant="landing"
        />
      </StrictMode>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    const nextHeading = await screen.findByRole('heading', { name: 'Choose focus areas' })
    await waitFor(() => expect(document.activeElement).toBe(nextHeading))
  })
})
