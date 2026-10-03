// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ResetPasswordCompleteForm } from '@/app/(frontend)/auth/password/reset/complete/ResetPasswordCompleteForm'
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/auth/utilities/supaBaseClient', () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('Website recovery password completion form', () => {
  test('shows the same safe error without a completion grant', () => {
    render(<ResetPasswordCompleteForm csrf={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired')
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a recovery email' })).toHaveAttribute(
      'href',
      '/auth/password/reset',
    )
  })
  test('validates inline, keeps retry on this page, and submits only the bound completion request', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, json: async () => ({ code: 'RECOVERY_TEMPORARILY_UNAVAILABLE' }) })
    vi.stubGlobal('fetch', fetch)
    render(<ResetPasswordCompleteForm csrf="offline-csrf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
    const password = screen.getByLabelText('New password')
    expect(password).toHaveAttribute('aria-invalid', 'true')
    expect(password).toHaveFocus()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(password, { target: { value: 'OfflinePassword123' } }) // pragma: allowlist secret
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'DifferentPassword123' } }) // pragma: allowlist secret
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
    expect(screen.getByLabelText('Confirm password')).toHaveFocus()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'OfflinePassword123' } }) // pragma: allowlist secret
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('you do not need another link'))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith(
      '/auth/password/complete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          csrf: 'offline-csrf',
          password: 'OfflinePassword123',
          confirmPassword: 'OfflinePassword123',
        }),
        redirect: 'error',
      }),
    ) // pragma: allowlist secret
  })
  test('discards password fields and provider details after a definitive link rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 'INVALID_OR_EXPIRED_LINK', message: 'private-provider-detail' }),
      }),
    )
    render(<ResetPasswordCompleteForm csrf="offline-csrf" />)
    for (const label of ['New password', 'Confirm password'])
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'OfflinePassword123' } }) // pragma: allowlist secret
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired'))
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
    expect(screen.queryByText('private-provider-detail')).not.toBeInTheDocument()
  })
})
