// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { FormBlock } from '@/blocks/Form/Component'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  push.mockReset()
})

const exampleCopy = {
  required: 'Synthetische Pflichtfeld-Meldung',
  requiredCue: '(Testpflichtfeld)',
  invalidEmail: 'Synthetisch ungültige E-Mail',
  invalidValue: 'Synthetisch ungültiger Wert',
  pending: 'Synthetischer Versand läuft',
  success: 'Synthetischer Empfang bestätigt',
  failure: 'Synthetischer Versandfehler',
  submit: 'Test absenden',
}

const fixtureForm = {
  id: 'contact',
  title: 'Testformular',
  confirmationType: 'message' as const,
  emails: [],
  fields: [],
}

it('shows pending immediately and reports a rejected submission in the selected interface language', async () => {
  let rejectRequest!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => (rejectRequest = resolve))),
  )

  render(<FormBlock copy={exampleCopy} enableIntro={false} form={fixtureForm} locale="de" />)

  const submit = screen.getByRole('button', { name: 'Test absenden' })
  fireEvent.click(submit)

  expect(await screen.findByRole('status')).toHaveTextContent(exampleCopy.pending)
  expect(submit).toBeDisabled()
  rejectRequest(Response.json({ error: 'Internal diagnostic' }, { status: 422 }))

  expect(await screen.findByRole('alert')).toHaveTextContent(exampleCopy.failure)
  expect(screen.queryByRole('status')).toBeNull()
  expect(submit).toBeEnabled()
})
