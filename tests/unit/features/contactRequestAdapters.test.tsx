// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FormBridgePublicContactSectionAdapter } from '@/features/contactRequests/FormBridgePublicContactSectionAdapter.client'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

const fillAndSubmitContactForm = () => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'I want to contact this clinic.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
}

describe('FormBridgePublicContactSectionAdapter', () => {
  it('submits the normalized contact payload through the form-bridge endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    global.fetch = fetchMock

    render(<FormBridgePublicContactSectionAdapter title="Contact findmydoc" description="Send a request." />)

    fillAndSubmitContactForm()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/form-bridge/public-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane@example.com',
          message: 'I want to contact this clinic.',
        }),
      })
    })
  })

  it('shows a form-bridge domain error without clearing the request', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'The contact request could not be accepted.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    render(<FormBridgePublicContactSectionAdapter title="Contact findmydoc" description="Send a request." />)
    fillAndSubmitContactForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('The contact request could not be accepted.')
    expect(screen.queryByText('Your request has been sent successfully.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
    expect(screen.getByLabelText('Message')).toHaveValue('I want to contact this clinic.')
  })

  it('uses the generic error for a non-JSON server failure and keeps the request', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response('upstream failure', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        }),
    )

    render(<FormBridgePublicContactSectionAdapter title="Contact findmydoc" description="Send a request." />)
    fillAndSubmitContactForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send your request right now.')
    expect(screen.queryByText('Your request has been sent successfully.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
    expect(screen.getByLabelText('Message')).toHaveValue('I want to contact this clinic.')
  })
})
