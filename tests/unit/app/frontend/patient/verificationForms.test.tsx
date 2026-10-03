// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { PatientVerificationForm } from '@/app/(frontend)/auth/confirm/PatientVerificationForm'
import { PatientVerificationResendForm } from '@/app/(frontend)/register/patient/PatientVerificationResendForm'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('patient verification public forms', () => {
  test('announces confirmation while the request is pending', async () => {
    let finish!: (value: unknown) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      ),
    )
    render(<PatientVerificationForm csrf="offline-csrf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }))
    expect(screen.getByRole('status')).toHaveTextContent('Confirming your email')
    expect(screen.getByRole('button', { name: 'Confirming...' })).toBeDisabled()
    finish({ ok: false, status: 503, json: async () => ({}) })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled())
  })
  test('announces resend while the controlled email request is pending', async () => {
    let finish!: () => void
    render(
      <PatientVerificationResendForm
        onRequest={() =>
          new Promise((resolve) => {
            finish = resolve
          })
        }
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'patient@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request verification email' }))
    expect(screen.getByRole('status')).toHaveTextContent('Requesting your verification email')
    finish()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('If an eligible registration exists'))
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('')
  })
  test('offers email-only resend after invalid-submit, inline error, correction and submit', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetch)
    render(<PatientVerificationResendForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Request verification email' }))
    const email = screen.getByRole('textbox', { name: 'Email' })
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(email, { target: { value: 'patient@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request verification email' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('If an eligible registration exists'))
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/register/patient/resend',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'patient@example.test' }),
        redirect: 'error',
      }),
    )
    expect(email).toHaveValue('')
  })
  test('keeps a temporary confirmation failure retryable on the current page', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ code: 'VERIFICATION_TEMPORARILY_UNAVAILABLE' }),
    })
    vi.stubGlobal('fetch', fetch)
    render(<PatientVerificationForm csrf="offline-csrf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('you do not need another link'))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith(
      '/auth/callback',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ csrf: 'offline-csrf' }) }),
    )
  })
  test('shows one neutral invalid state and a resend entry without account details', () => {
    render(<PatientVerificationForm csrf={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a verification email' })).toHaveAttribute(
      'href',
      '/register/patient#patient-verification-resend',
    )
  })
})
