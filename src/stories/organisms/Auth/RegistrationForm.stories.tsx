import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'

import { RegistrationForm } from '@/components/organisms/Auth/RegistrationForm'
import { withViewportStory } from '../../utils/viewportMatrix'

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

const clinicRegistrationMobileDenseBase: Story = {
  args: {
    ...SubmittedWithoutRedirect.args,
    description: 'Verify your clinic to start receiving patient requests and keep your contact details in sync.',
    links: {
      login: { href: '/auth/login', text: 'Already registered? Sign in with your existing clinic account' },
      home: { href: '/', text: '← Back to the public homepage and treatment overview' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText('Clinic Name')).toBeInTheDocument()
    await expect(canvas.getByLabelText('First Name')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Last Name')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /submit registration/i })).toBeInTheDocument()
    await expect(canvas.getByText(/already registered\?/i)).toBeInTheDocument()
  },
}

export const DenseForm320: Story = withViewportStory(clinicRegistrationMobileDenseBase, 'public320', 'Dense form / 320')
export const DenseForm375: Story = withViewportStory(clinicRegistrationMobileDenseBase, 'public375', 'Dense form / 375')
export const DenseForm640: Story = withViewportStory(clinicRegistrationMobileDenseBase, 'public640', 'Dense form / 640')
export const DenseForm768: Story = withViewportStory(clinicRegistrationMobileDenseBase, 'public768', 'Dense form / 768')
export const DenseForm1024: Story = withViewportStory(
  clinicRegistrationMobileDenseBase,
  'public1024',
  'Dense form / 1024',
)
export const DenseForm1280: Story = withViewportStory(
  clinicRegistrationMobileDenseBase,
  'public1280',
  'Dense form / 1280',
)
export const DenseForm320Short: Story = withViewportStory(
  clinicRegistrationMobileDenseBase,
  'public320Short',
  'Dense form / 320 short',
)

export const PasswordMismatch320: Story = withViewportStory(PasswordMismatch, 'public320', 'Validation / 320')
export const PasswordMismatch375: Story = withViewportStory(PasswordMismatch, 'public375', 'Validation / 375')
export const PasswordMismatch640: Story = withViewportStory(PasswordMismatch, 'public640', 'Validation / 640')
export const PasswordMismatch768: Story = withViewportStory(PasswordMismatch, 'public768', 'Validation / 768')
export const PasswordMismatch1024: Story = withViewportStory(PasswordMismatch, 'public1024', 'Validation / 1024')
export const PasswordMismatch1280: Story = withViewportStory(PasswordMismatch, 'public1280', 'Validation / 1280')
export const PasswordMismatch375Short: Story = withViewportStory(
  PasswordMismatch,
  'public375Short',
  'Validation / 375 short',
)

export const Submitted320: Story = withViewportStory(SubmittedWithoutRedirect, 'public320', 'Success / 320')
export const Submitted375: Story = withViewportStory(SubmittedWithoutRedirect, 'public375', 'Success / 375')
export const Submitted640: Story = withViewportStory(SubmittedWithoutRedirect, 'public640', 'Success / 640')
export const Submitted768: Story = withViewportStory(SubmittedWithoutRedirect, 'public768', 'Success / 768')
export const Submitted1024: Story = withViewportStory(SubmittedWithoutRedirect, 'public1024', 'Success / 1024')
export const Submitted1280: Story = withViewportStory(SubmittedWithoutRedirect, 'public1280', 'Success / 1280')
export const Submitted375Short: Story = withViewportStory(
  SubmittedWithoutRedirect,
  'public375Short',
  'Success / 375 short',
)
