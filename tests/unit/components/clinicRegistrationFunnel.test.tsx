// @vitest-environment jsdom
import { StrictMode } from 'react'
import '@testing-library/jest-dom'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'
import { buildClinicApplicationCopy } from '@/features/uiCopy/clinicApplication'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ClinicRegistrationFunnel } from '@/components/templates/ClinicRegistrationFunnel'

const copy = buildClinicApplicationCopy(
  createTranslator({ locale: 'en', messages: englishMessages, namespace: 'website.clinicApplication' }),
)

describe('ClinicRegistrationFunnel focus management', () => {
  it('does not focus the first step heading during the initial StrictMode render', () => {
    render(
      <StrictMode>
        <ClinicRegistrationFunnel copy={copy} locale="en" onSubmit={async () => undefined} variant="landing" />
      </StrictMode>,
    )

    expect(document.activeElement).not.toBe(screen.getByRole('heading', { name: 'Enter clinic details' }))
  })

  it('focuses the active step heading after an explicit step change', async () => {
    render(
      <StrictMode>
        <ClinicRegistrationFunnel
          copy={copy}
          locale="en"
          onSubmit={async () => undefined}
          initialValues={{
            clinicName: 'Demo Clinic',
            clinicWebsite: 'https://clinic.example',
          }}
          variant="landing"
        />
      </StrictMode>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    const nextHeading = await screen.findByRole('heading', { name: 'Choose specialties' })
    await waitFor(() => expect(document.activeElement).toBe(nextHeading))
  })
})
