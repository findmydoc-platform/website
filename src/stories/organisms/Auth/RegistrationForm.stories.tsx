import type { Meta, StoryObj } from '@storybook/react-vite'
import { within, userEvent, waitFor } from '@storybook/testing-library'
import { expect } from '@storybook/jest'

import { RegistrationForm } from '@/components/organisms/Auth/RegistrationForm'
import { withMockRouter } from '../../utils/routerDecorator'

const sharedFields = [
  { name: 'clinicName', label: 'Clinic Name', type: 'text', required: true },
  { name: 'contactEmail', label: 'Email', type: 'email', required: true },
  { name: 'password', label: 'Password', type: 'password', required: true },
  { name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true },
]

const meta = {
  title: 'Organisms/Auth/RegistrationForm',
  component: RegistrationForm,
  decorators: [withMockRouter],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof RegistrationForm>

export default meta

type Story = StoryObj<typeof meta>

export const ClinicRegistration: Story = {
  args: {
    title: 'Register Clinic',
    description: 'Verify your clinic to start receiving patient requests.',
    successRedirect: '/register/thanks',
    submitButtonText: 'Submit Registration',
    fields: [...sharedFields, { name: 'country', label: 'Country', type: 'text', required: true }],
    links: {
      login: { href: '/auth/login', text: 'Already registered? Sign in' },
      home: { href: '/', text: '← Back to home' },
    },
    onSubmit: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    },
  },
}

export const PasswordMismatch: Story = {
  args: {
    ...ClinicRegistration.args,
    title: 'Clinic Registration – Validation Sample',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Clinic Name'), 'Aurora Dental')
    await userEvent.type(canvas.getByLabelText('Email'), 'hello@auroradental.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'Secret123')
    await userEvent.type(canvas.getByLabelText('Confirm Password'), 'Secret456')
    await userEvent.type(canvas.getByLabelText('Country'), 'Germany')
    await userEvent.click(canvas.getByRole('button', { name: /submit registration/i }))

    await waitFor(() => {
      expect(canvas.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  },
}
