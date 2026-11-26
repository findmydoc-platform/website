// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { FormBlock } from '@/blocks/Form/Component'
import { Text } from '@/blocks/Form/Text'
import { Form } from '@/components/organisms/Form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('marks the fixed English loading status within a German CMS form', () => {
  render(
    <article lang="de">
      <Form form={{ id: 'contact' }} isLoading />
    </article>,
  )

  expect(screen.getByRole('status').getAttribute('lang')).toBe('en')
})

it('retains German form labels and marks the fixed English required cue and validation', async () => {
  render(
    <article lang="de">
      <Form
        fields={{ text: Text }}
        form={{
          id: 'contact',
          fields: [{ blockType: 'text', name: 'firstName', label: 'Vorname', required: true }],
          submitButtonLabel: 'Senden',
        }}
      />
    </article>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Senden' }))
  const validation = await screen.findByText('This field is required.')

  expect(screen.getByText('Vorname').closest('[lang]')?.getAttribute('lang')).toBe('de')
  expect(screen.getByText('(required)').closest('[lang]')?.getAttribute('lang')).toBe('en')
  expect(validation.closest('[lang]')?.getAttribute('lang')).toBe('en')
})

it.each([
  { responseBody: {}, message: '500: Form submission failed: 500', lang: 'en' },
  { responseBody: { error: 'Nicht gespeichert' }, message: '500: Nicht gespeichert', lang: 'de' },
])('uses the language of the submission alert: $message', async ({ responseBody, message, lang }) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(responseBody, { status: 500 })))
  render(
    <article lang="de">
      <FormBlock
        enableIntro={false}
        form={{
          id: 'contact',
          title: 'Kontakt',
          confirmationType: 'message',
          emails: [],
          fields: [],
          submitButtonLabel: 'Senden',
        }}
      />
    </article>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Senden' }))
  const alert = await screen.findByRole('alert')

  expect(alert.textContent).toBe(message)
  expect(alert.closest('[lang]')?.getAttribute('lang')).toBe(lang)
})
