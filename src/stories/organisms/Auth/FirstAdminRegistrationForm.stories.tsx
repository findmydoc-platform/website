import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'

import { FirstAdminRegistrationForm } from '@/components/organisms/Auth/FirstAdminRegistrationForm'
import { withMockRouter } from '../../utils/routerDecorator'

const submitFirstAdminRegistration = () => new Promise<void>((resolve) => setTimeout(resolve, 120))

const meta = {
  title: 'Domain/Auth/Organisms/FirstAdminRegistrationForm',
  component: FirstAdminRegistrationForm,
  decorators: [withMockRouter],
  parameters: {
    layout: 'centered',
  },
  tags: [
    'autodocs',
    'test',
    'domain:auth',
    'layer:organism',
    'status:stable',
    'used-in:block:first-admin-registration-form',
  ],
  args: {
    onSubmit: submitFirstAdminRegistration,
  },
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

    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      await userEvent.type(canvas.getByLabelText(/confirm password/i), 'Mismatch123')
      await userEvent.click(canvas.getByRole('button', { name: /create admin user/i }))

      await waitFor(() => {
        expect(canvas.getByText(/passwords do not match/i)).toBeInTheDocument()
      })
    } finally {
      consoleSpy.mockRestore()
    }

    await userEvent.clear(canvas.getByLabelText(/confirm password/i))
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'SecurePass123')
    await userEvent.click(canvas.getByRole('button', { name: /create admin user/i }))

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /creating account/i })).toBeInTheDocument()
    })
  },
}
