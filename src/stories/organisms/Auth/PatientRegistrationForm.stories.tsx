import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { Decorator } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { userEvent, within, waitFor } from '@storybook/testing-library'
import { useEffect, useRef } from 'react'

import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'
import { withMockRouter } from '../../utils/routerDecorator'

const createDelayedJsonResponse = (body: Record<string, unknown>, status = 200, delayMs = 120) =>
  new Promise<Response>((resolve) => {
    setTimeout(() => {
      resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }, delayMs)
  })

const mockFetch: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url

  if (url.includes('/auth/v1/signup')) {
    return createDelayedJsonResponse({
      user: { id: 'patient-1', email: 'patient@findmydoc.com' },
      session: null,
    })
  }

  if (url.includes('/api/auth/register/patient/metadata')) {
    return createDelayedJsonResponse({ success: true })
  }

  if (url.includes('/api/auth/register/patient/cleanup')) {
    return createDelayedJsonResponse({ success: true })
  }

  return createDelayedJsonResponse({ success: true })
}

const withMockFetch: Decorator = (Story, context) => {
  const originalFetch = useRef(globalThis.fetch)

  useEffect(() => {
    if (typeof process !== 'undefined') {
      process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'public-anon-key'
    }

    globalThis.fetch = mockFetch
    return () => {
      globalThis.fetch = originalFetch.current
    }
  }, [])

  return <Story {...context} />
}

const meta = {
  title: 'Organisms/Auth/PatientRegistrationForm',
  component: PatientRegistrationForm,
  decorators: [withMockRouter, withMockFetch],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof PatientRegistrationForm>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/first name/i), 'Jamie')
    await userEvent.type(canvas.getByLabelText(/last name/i), 'Quinn')
    await userEvent.type(canvas.getByLabelText(/email/i), 'patient@findmydoc.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'SecurePass123')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'Mismatch123')
    await userEvent.click(canvas.getByRole('button', { name: /create patient account/i }))

    await waitFor(() => {
      expect(canvas.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    await userEvent.clear(canvas.getByLabelText(/confirm password/i))
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'SecurePass123')
    await userEvent.click(canvas.getByRole('button', { name: /create patient account/i }))

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /creating account/i })).toBeInTheDocument()
    })
  },
}
