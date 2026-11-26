// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { authCopySentences } from '@/features/uiCopy/patientAuthPresentation'
import de from '@findmydoc-platform/ui-copy/de.json'
import en from '@findmydoc-platform/ui-copy/en.json'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { RecoveryConfirmationForm } from '@/app/(frontend)/auth/confirm/RecoveryConfirmationForm'

const catalog = en.auth.passwordRecovery
const englishCopy = {
  ...catalog.confirmation,
  shared: {
    invalidTitle: authCopySentences(catalog.shared.invalidLink, 'en')[0]!,
    invalidLink: catalog.shared.invalidLink,
    retry: catalog.shared.retry,
    requestLink: { href: '/en/auth/password/reset', label: catalog.shared.requestLink },
  },
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
test('confirms only on explicit user action and keeps a temporary failure retryable', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
  vi.stubGlobal('fetch', fetch)
  render(<RecoveryConfirmationForm copy={englishCopy} locale="en" csrf="offline-csrf" />)
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm recovery' }))
  expect(screen.getByRole('status')).toHaveTextContent(/\S/)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(fetch).toHaveBeenLastCalledWith(
    '/auth/callback?flow=recovery',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ csrf: 'offline-csrf' }), redirect: 'error' }),
  )
})
test('shares safe error and request entry for invalid recovery', () => {
  const catalog = de.auth.passwordRecovery
  render(
    <RecoveryConfirmationForm
      locale="de"
      csrf={null}
      copy={{
        ...catalog.confirmation,
        shared: {
          invalidTitle: authCopySentences(catalog.shared.invalidLink, 'de')[0]!,
          invalidLink: catalog.shared.invalidLink,
          retry: catalog.shared.retry,
          requestLink: { href: '/auth/password/reset', label: catalog.shared.requestLink },
        },
      }}
    />,
  )
  expect(screen.getByRole('alert')).toBeVisible()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByRole('link')).toHaveAttribute('href', '/auth/password/reset')
})
