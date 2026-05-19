// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LandingContact } from '@/components/organisms/Landing/LandingContact'
import { DEFAULT_CONTACT_FORM_LABELS } from '@/components/templates/HoldingPageConcept/contactForm.shared'

describe('LandingContact', () => {
  it('can render as the page h1 and submit tracking fields with the contact payload', async () => {
    const submitContact = vi.fn().mockResolvedValue(undefined)

    render(
      <LandingContact
        title="Contact findmydoc"
        description="Send a request."
        headingAs="h1"
        trackingFields={{
          clinic: 'berlin-health-clinic',
          empty: '',
          source: 'clinic-detail',
        }}
        onSubmitContact={submitContact}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Contact findmydoc' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'I want to contact this clinic.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(submitContact).toHaveBeenCalledWith(
        'holding-contact',
        {
          clinic: 'berlin-health-clinic',
          source: 'clinic-detail',
          name: 'Jane Doe',
          email: 'jane@example.com',
          message: 'I want to contact this clinic.',
        },
        'Could not send your request right now.',
      )
    })
  })

  it('uses localized field labels and links validation errors to the invalid field', async () => {
    render(
      <LandingContact
        title="Contact findmydoc"
        description="Send a request."
        contactFormLabels={{
          ...DEFAULT_CONTACT_FORM_LABELS,
          emailPlaceholder: 'E-Mail-Adresse',
          emailRequiredMessage: 'E-Mail-Adresse ist erforderlich.',
          messagePlaceholder: 'Nachricht',
          namePlaceholder: 'Name',
        }}
      />,
    )

    const nameField = screen.getByLabelText('Name')
    const emailField = screen.getByLabelText('E-Mail-Adresse')

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    const validationError = await screen.findByRole('alert')

    expect(screen.getByText('Name')).toBeVisible()
    expect(screen.getByText('E-Mail-Adresse')).toBeVisible()
    expect(emailField).toBeRequired()
    expect(validationError).toHaveTextContent('Name is required.')
    expect(nameField).toHaveAttribute('aria-invalid', 'true')
    expect(nameField).toHaveAttribute('aria-describedby', validationError.id)
  })
})
