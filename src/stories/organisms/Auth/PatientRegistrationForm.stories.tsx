import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from '@storybook/jest'
import { userEvent, within, waitFor } from '@storybook/testing-library'
import { vi } from 'vitest'

import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'
import { withMockRouter } from '../../utils/routerDecorator'
import { createDelayedJsonResponse } from '../../utils/mockHelpers'
import { createMockFetchDecorator } from '../../utils/fetchDecorator'

const mockFetch: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString()

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

const meta = {
  title: 'Organisms/Auth/PatientRegistrationForm',
  component: PatientRegistrationForm,
  decorators: [
    withMockRouter,
    createMockFetchDecorator(mockFetch, () => {
      if (typeof process !== 'undefined') {
        process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'public-anon-key'
      }
    }),
  ],
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

    // Suppress expected registration error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await userEvent.click(canvas.getByRole('button', { name: /create patient account/i }))

    await waitFor(() => {
      expect(canvas.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    consoleSpy.mockRestore()

    await userEvent.clear(canvas.getByLabelText(/confirm password/i))
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'SecurePass123')
    await userEvent.click(canvas.getByRole('button', { name: /create patient account/i }))

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /creating account/i })).toBeInTheDocument()
    })
  },
}
