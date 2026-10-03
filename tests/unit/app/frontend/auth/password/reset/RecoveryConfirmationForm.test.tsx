// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { RecoveryConfirmationForm } from '@/app/(frontend)/auth/confirm/RecoveryConfirmationForm'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
test('confirms only on explicit user action and keeps a temporary failure retryable', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
  vi.stubGlobal('fetch', fetch)
  render(<RecoveryConfirmationForm csrf="offline-csrf" />)
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm recovery' }))
  expect(screen.getByRole('status')).toHaveTextContent('Confirming your recovery link')
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('you do not need another link'))
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(fetch).toHaveBeenLastCalledWith(
    '/auth/callback?flow=recovery',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ csrf: 'offline-csrf' }), redirect: 'error' }),
  )
})
test('shares safe error and request entry for invalid recovery', () => {
  render(<RecoveryConfirmationForm csrf={null} />)
  expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Request a recovery email' })).toHaveAttribute('href', '/auth/password/reset')
})
