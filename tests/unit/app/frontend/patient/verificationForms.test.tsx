// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { PatientVerificationForm } from '@/app/(frontend)/auth/confirm/PatientVerificationForm'
import { PatientVerificationResendForm } from '@/app/(frontend)/register/patient/PatientVerificationResendForm'

const confirmationCopy = {
  title: 'Verification fixture',
  description: 'Confirm the fixture email.',
  announcementPending: 'Confirming the fixture email.',
  invalid: 'The fixture confirmation link is no longer usable.',
  retry: 'The fixture confirmation is temporarily unavailable.',
  inquiryContinuation: 'Continue the saved fixture inquiry.',
  completed: 'Fixture confirmation is complete.',
  confirming: 'Confirming the fixture…',
  retryAction: 'Retry fixture confirmation',
  continueAction: 'Continue fixture inquiry',
  confirm: 'Confirm fixture email',
  resendLink: 'Resend fixture email',
  resendHref: '/en/register/patient#patient-verification-resend',
}

const resendCopy = {
  title: 'Resend fixture',
  description: 'Use the address registered in this test.',
  announcementPending: 'Submitting the fixture request.',
  success: 'The fixture request was accepted.',
  error: 'The fixture request failed.',
  email: 'Fixture email',
  emailValidation: {
    typeMismatch: 'The fixture email is malformed.',
    valueMissing: 'The fixture email is missing.',
  },
  requesting: 'Submitting the fixture…',
  submit: 'Submit fixture email',
}

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
    render(<PatientVerificationForm copy={confirmationCopy} csrf="offline-csrf" />)
    fireEvent.click(screen.getByRole('button', { name: confirmationCopy.confirm }))
    expect(screen.getByRole('status')).toHaveTextContent(confirmationCopy.announcementPending)
    expect(screen.getByRole('button', { name: confirmationCopy.confirming })).toBeDisabled()
    finish({ ok: false, status: 503, json: async () => ({}) })
    await waitFor(() => expect(screen.getByRole('button', { name: confirmationCopy.retryAction })).toBeEnabled())
  })
  test('announces resend while the controlled email request is pending', async () => {
    let finish!: () => void
    render(
      <PatientVerificationResendForm
        copy={resendCopy}
        onRequest={() =>
          new Promise((resolve) => {
            finish = resolve
          })
        }
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: resendCopy.email }), {
      target: { value: 'patient@example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: resendCopy.submit }))
    expect(screen.getByRole('status')).toHaveTextContent(resendCopy.announcementPending)
    finish()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(resendCopy.success))
    expect(screen.getByRole('textbox', { name: resendCopy.email })).toHaveValue('')
  })
  test('offers email-only resend after invalid-submit, inline error, correction and submit', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetch)
    render(<PatientVerificationResendForm copy={resendCopy} />)
    fireEvent.click(screen.getByRole('button', { name: resendCopy.submit }))
    const email = screen.getByRole('textbox', { name: resendCopy.email })
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription(resendCopy.emailValidation.valueMissing)
    expect(email).toHaveFocus()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(email, { target: { value: 'patient@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: resendCopy.submit }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(resendCopy.success))
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
    render(<PatientVerificationForm copy={confirmationCopy} csrf="offline-csrf" />)
    fireEvent.click(screen.getByRole('button', { name: confirmationCopy.confirm }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(confirmationCopy.retry))
    fireEvent.click(screen.getByRole('button', { name: confirmationCopy.retryAction }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith(
      '/auth/callback',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ csrf: 'offline-csrf' }) }),
    )
  })
  test('shows one neutral invalid state and a resend entry without account details', () => {
    render(<PatientVerificationForm copy={confirmationCopy} csrf={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent(confirmationCopy.invalid)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: confirmationCopy.resendLink })).toHaveAttribute(
      'href',
      confirmationCopy.resendHref,
    )
  })
})
