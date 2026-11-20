// @vitest-environment jsdom
import '@testing-library/jest-dom'
import en from '@findmydoc-platform/ui-copy/en.json'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { ResetPasswordRequestForm } from '@/app/(frontend)/auth/password/reset/ResetPasswordRequestForm'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('keeps failed requests on the recovery form without exposing response details', async () => {
  const providerDetail = 'synthetic-private-provider-detail'
  const fetch = vi.fn().mockResolvedValue({ status: 503, ok: false, json: async () => ({ error: providerDetail }) })
  vi.stubGlobal('fetch', fetch)
  render(<ResetPasswordRequestForm copy={en.auth.passwordRecovery.request} />)

  const email = screen.getByRole('textbox', { name: 'Email' })
  expect(email.closest('form')).toHaveAttribute('method', 'post')
  expect(email.closest('form')).toHaveAttribute('action', '/api/auth/password/reset')
  fireEvent.change(email, { target: { value: 'patient@example.test' } })
  const submit = screen.getByRole('button')
  fireEvent.click(submit)

  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByText(providerDetail)).not.toBeInTheDocument()
  expect(email).toHaveValue('patient@example.test')
  expect(submit).toBeEnabled()
})
