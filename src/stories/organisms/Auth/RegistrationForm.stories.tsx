import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'

import { RegistrationForm } from '@/components/organisms/Auth/RegistrationForm'

const sharedFields = [
  { name: 'clinicName', label: 'Clinic Name', type: 'text', required: true },
  { name: 'contactFirstName', label: 'First Name', type: 'text', required: true, gridCol: '2' as const },
  { name: 'contactLastName', label: 'Last Name', type: 'text', required: true, gridCol: '2' as const },
  { name: 'contactEmail', label: 'Email', type: 'email', required: true },
  { name: 'street', label: 'Street', type: 'text', required: true, gridCol: '2' as const },
  { name: 'houseNumber', label: 'House Number', type: 'text', required: true, gridCol: '2' as const },
  { name: 'country', label: 'Country', type: 'text', required: true },
  { name: 'password', label: 'Password', type: 'password', required: true },
  { name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true },
]

const meta = {
  title: 'Domain/Auth/Organisms/RegistrationForm',
  component: RegistrationForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'test', 'domain:auth', 'layer:organism', 'status:stable', 'used-in:block:registration-form'],
} satisfies Meta<typeof RegistrationForm>

export default meta

type Story = StoryObj<typeof meta>

export const ClinicRegistration: Story = {
  args: {
    title: 'Register Clinic',
    description: 'Verify your clinic to start receiving patient requests.',
    submitButtonText: 'Submit Registration',
    fields: sharedFields,
    links: {
      login: { href: '/auth/login', text: 'Already registered? Sign in' },
      home: { href: '/', text: '← Back to home' },
    },
    onSubmit: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    },
  },
}

export const SubmittedWithoutRedirect: Story = {
  args: {
    ...ClinicRegistration.args,
    successMessage: 'Thanks, your clinic registration has been submitted for review.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Clinic Name'), 'Aurora Dental')
    await userEvent.type(canvas.getByLabelText('First Name'), 'Ana')
    await userEvent.type(canvas.getByLabelText('Last Name'), 'Meyer')
    await userEvent.type(canvas.getByLabelText('Email'), 'hello@auroradental.com')
    await userEvent.type(canvas.getByLabelText('Street'), 'River Street')
    await userEvent.type(canvas.getByLabelText('House Number'), '14')
    await userEvent.type(canvas.getByLabelText('Country'), 'Germany')
    await userEvent.type(canvas.getByLabelText('Password'), 'Secret123')
    await userEvent.type(canvas.getByLabelText('Confirm Password'), 'Secret123')

    await userEvent.click(canvas.getByRole('button', { name: /submit registration/i }))

    await waitFor(() => {
      expect(canvas.getByText(/submitted for review/i)).toBeInTheDocument()
    })
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
    await userEvent.type(canvas.getByLabelText('First Name'), 'Ana')
    await userEvent.type(canvas.getByLabelText('Last Name'), 'Meyer')
    await userEvent.type(canvas.getByLabelText('Email'), 'hello@auroradental.com')
    await userEvent.type(canvas.getByLabelText('Street'), 'River Street')
    await userEvent.type(canvas.getByLabelText('House Number'), '14')
    await userEvent.type(canvas.getByLabelText('Country'), 'Germany')
    await userEvent.type(canvas.getByLabelText('Password'), 'Secret123')
    await userEvent.type(canvas.getByLabelText('Confirm Password'), 'Secret456')

    await userEvent.click(canvas.getByRole('button', { name: /submit registration/i }))

    await waitFor(() => {
      expect(canvas.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  },
}

export const ClinicRegistrationMobileDense: Story = {
  args: {
    ...SubmittedWithoutRedirect.args,
    description: 'Verify your clinic to start receiving patient requests and keep your contact details in sync.',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  play: SubmittedWithoutRedirect.play,
}
