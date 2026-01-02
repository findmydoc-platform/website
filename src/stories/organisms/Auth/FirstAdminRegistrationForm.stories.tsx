import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { userEvent, within, waitFor } from '@storybook/testing-library'

import { FirstAdminRegistrationForm } from '@/components/organisms/Auth/FirstAdminRegistrationForm'
import { withMockRouter } from '../../utils/routerDecorator'
import { createDelayedJsonResponse } from '../../utils/mockHelpers'
import { createMockFetchDecorator } from '../../utils/fetchDecorator'

const mockFetch: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString()
  if (url.includes('/api/auth/register/first-admin')) {
    return createDelayedJsonResponse({ success: true })
  }

  return createDelayedJsonResponse({ success: true })
}

const meta = {
  title: 'Organisms/Auth/FirstAdminRegistrationForm',
  component: FirstAdminRegistrationForm,
  decorators: [withMockRouter, createMockFetchDecorator(mockFetch)],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof FirstAdminRegistrationForm>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/first name/i), 'Alex')
    await userEvent.type(canvas.getByLabelText(/last name/i), 'Morgan')
    await userEvent.type(canvas.getByLabelText(/email/i), 'admin@findmydoc.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'SecurePass123')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'Mismatch123')
    await userEvent.click(canvas.getByRole('button', { name: /create admin user/i }))

    await waitFor(() => {
      expect(canvas.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    await userEvent.clear(canvas.getByLabelText(/confirm password/i))
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'SecurePass123')
    await userEvent.click(canvas.getByRole('button', { name: /create admin user/i }))

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /creating account/i })).toBeInTheDocument()
    })
  },
}
