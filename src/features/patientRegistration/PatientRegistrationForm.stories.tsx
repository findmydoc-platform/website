import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'

import { PatientRegistrationForm } from './PatientRegistrationForm.client'
import { withMockRouter } from '@/stories/utils/routerDecorator'
import { withViewportStory } from '@/stories/utils/viewportMatrix'

const exampleCopy = {
  title: 'Example patient registration',
  description: 'Fill in this example to try registration.',
  submitButtonText: 'Submit example registration',
  fields: [
    { name: 'firstName', label: 'First name', type: 'text', required: true, gridCol: '2' as const },
    { name: 'lastName', label: 'Last name', type: 'text', required: true, gridCol: '2' as const },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'password', label: 'Password', type: 'password', required: true },
    { name: 'confirmPassword', label: 'Confirm password', type: 'password', required: true },
  ],
  formMessages: {
    validation: {
      firstName: { valueMissing: 'Enter a first name.' },
      lastName: { valueMissing: 'Enter a last name.' },
      email: { valueMissing: 'Enter an email.', typeMismatch: 'Use a valid email.' },
      password: { valueMissing: 'Enter a password.', tooShort: 'Enter a longer password.' },
      confirmPassword: { valueMissing: 'Repeat the password.', tooShort: 'Enter a longer password.' },
    },
    passwordMismatch: 'Use the same password in both fields.', // pragma: allowlist secret
    pending: 'Submitting the example…',
    loginPrompt: 'Already signed up?',
    fallbackError: 'The example could not be submitted.',
  },
  successMessage: 'Your example was submitted.',
  signInLink: 'Sign in',
  homeLink: 'Back home',
  errors: {
    missingCredentials: 'Enter an email and password.',
    invalidPayload: 'Check the example fields.',
    requestRejected: 'The service rejected the example.',
    temporarilyUnavailable: 'The example is temporarily unavailable.',
    setupFailed: 'Example registration failed.',
    registrationFailed: 'Try submitting the example again.',
  },
}

const submitPatientRegistration = () => new Promise<void>((resolve) => setTimeout(resolve, 120))

const meta = {
  title: 'Domain/Auth/Organisms/PatientRegistrationForm',
  component: PatientRegistrationForm,
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
    'used-in:block:patient-registration-form',
  ],
  args: {
    copy: exampleCopy,
    loginHref: '/login/patient',
    successHref: '/login/patient?message=patient-check-email',
    onSubmit: submitPatientRegistration,
  },
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

    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      await userEvent.click(canvas.getByRole('button', { name: exampleCopy.submitButtonText }))

      await waitFor(() => {
        expect(canvas.getByText(exampleCopy.formMessages.passwordMismatch)).toBeInTheDocument()
      })
    } finally {
      consoleSpy.mockRestore()
    }

    await userEvent.clear(canvas.getByLabelText(/confirm password/i))
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'SecurePass123')
    await userEvent.click(canvas.getByRole('button', { name: exampleCopy.submitButtonText }))

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: exampleCopy.formMessages.pending })).toBeInTheDocument()
    })
  },
}

const validationViewportBase: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/first name/i), 'Jamie')
    await userEvent.type(canvas.getByLabelText(/last name/i), 'Quinn')
    await userEvent.type(canvas.getByLabelText(/email/i), 'patient@findmydoc.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'SecurePass123')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'Mismatch123')

    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {})

    try {
      await userEvent.click(canvas.getByRole('button', { name: exampleCopy.submitButtonText }))

      await waitFor(() => {
        expect(canvas.getByText(exampleCopy.formMessages.passwordMismatch)).toBeInTheDocument()
      })
    } finally {
      consoleSpy.mockRestore()
    }
  },
}

const successViewportBase: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/first name/i), 'Jamie')
    await userEvent.type(canvas.getByLabelText(/last name/i), 'Quinn')
    await userEvent.type(canvas.getByLabelText(/email/i), 'patient@findmydoc.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'SecurePass123')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'SecurePass123')

    await userEvent.click(canvas.getByRole('button', { name: exampleCopy.submitButtonText }))

    await waitFor(() => {
      expect(canvas.getByText(exampleCopy.successMessage)).toBeInTheDocument()
    })
  },
}

export const Validation320: Story = withViewportStory(validationViewportBase, 'public320', 'Validation / 320')
export const Validation375: Story = withViewportStory(validationViewportBase, 'public375', 'Validation / 375')
export const Validation640: Story = withViewportStory(validationViewportBase, 'public640', 'Validation / 640')
export const Validation768: Story = withViewportStory(validationViewportBase, 'public768', 'Validation / 768')
export const Validation1024: Story = withViewportStory(validationViewportBase, 'public1024', 'Validation / 1024')
export const Validation1280: Story = withViewportStory(validationViewportBase, 'public1280', 'Validation / 1280')
export const Validation375Short: Story = withViewportStory(
  validationViewportBase,
  'public375Short',
  'Validation / 375 short',
)

export const Success320: Story = withViewportStory(successViewportBase, 'public320', 'Success / 320')
export const Success375: Story = withViewportStory(successViewportBase, 'public375', 'Success / 375')
export const Success640: Story = withViewportStory(successViewportBase, 'public640', 'Success / 640')
export const Success768: Story = withViewportStory(successViewportBase, 'public768', 'Success / 768')
export const Success1024: Story = withViewportStory(successViewportBase, 'public1024', 'Success / 1024')
export const Success1280: Story = withViewportStory(successViewportBase, 'public1280', 'Success / 1280')
export const Success375Short: Story = withViewportStory(successViewportBase, 'public375Short', 'Success / 375 short')
