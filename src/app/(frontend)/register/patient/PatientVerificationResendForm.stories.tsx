import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PatientVerificationResendForm } from './PatientVerificationResendForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'

const copy = {
  title: 'Resend fixture',
  description: 'Use the address registered in this story.',
  announcementPending: 'Submitting the fixture request.',
  success: 'The fixture request was accepted.',
  error: 'The fixture request failed.',
  email: 'Fixture email',
  emailValidation: {
    typeMismatch: 'The fixture email is malformed.',
    valueMissing: 'The fixture email is missing.',
  },
  requesting: 'Submitting the fixture…',
  submit: 'Submit fixture email',
}

const meta = {
  title: 'Domain/Auth/Pages/PatientVerificationResend',
  component: PatientVerificationResendForm,
  args: { copy, onRequest: fn().mockResolvedValue(undefined) },
  tags: ['autodocs', 'domain:auth', 'layer:page', 'status:stable', 'used-in:route:/register/patient'],
  decorators: [
    (Story) => (
      <PublicAuthRouteShell>
        <Story />
      </PublicAuthRouteShell>
    ),
  ],
} satisfies Meta<typeof PatientVerificationResendForm>
export default meta
type Story = StoryObj<typeof meta>
export const EmailRequest: Story = {}
export const InlineValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: copy.submit }))
    await expect(canvas.getByRole('textbox', { name: copy.email })).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(canvas.getByRole('textbox', { name: copy.email }), 'patient@example.test')
    await expect(canvas.getByRole('textbox', { name: copy.email })).not.toHaveAttribute('aria-invalid', 'true')
    await userEvent.click(canvas.getByRole('button', { name: copy.submit }))
    await expect(await canvas.findByRole('status')).toHaveTextContent(copy.success)
    await expect(canvas.getByRole('textbox', { name: copy.email })).toHaveValue('')
  },
}
