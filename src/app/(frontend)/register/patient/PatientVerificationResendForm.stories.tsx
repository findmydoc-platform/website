import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PatientVerificationResendForm } from './PatientVerificationResendForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'

const meta = {
  title: 'Domain/Auth/Pages/PatientVerificationResend',
  component: PatientVerificationResendForm,
  args: { onRequest: fn().mockResolvedValue(undefined) },
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
    await userEvent.click(canvas.getByRole('button', { name: 'Request verification email' }))
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email' }), 'patient@example.test')
    await expect(canvas.getByRole('textbox', { name: 'Email' })).not.toHaveAttribute('aria-invalid', 'true')
    await userEvent.click(canvas.getByRole('button', { name: 'Request verification email' }))
    await expect(await canvas.findByRole('status')).toHaveTextContent('If an eligible registration exists')
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveValue('')
  },
}
