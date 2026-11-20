import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PatientVerificationView } from './PatientVerificationForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'

const copy = {
  title: 'Verification fixture',
  description: 'Confirm the fixture email.',
  announcementPending: 'Confirming the fixture email.',
  invalid: 'The fixture confirmation link is no longer usable.',
  retry: 'The fixture confirmation is temporarily unavailable.',
  inquiryContinuation: 'Continue the saved fixture inquiry.',
  completed: 'Fixture confirmation is complete.',
  confirming: 'Confirming the fixture…',
  retryAction: 'Retry fixture confirmation',
  continueAction: 'Continue fixture inquiry',
  confirm: 'Confirm fixture email',
  resendLink: 'Resend fixture email',
  resendHref: '/register/patient#patient-verification-resend',
}

const meta = {
  title: 'Domain/Auth/Pages/PatientVerification',
  component: PatientVerificationView,
  args: { copy, onConfirm: fn() },
  tags: ['autodocs', 'domain:auth', 'layer:page', 'status:stable', 'used-in:route:/auth/confirm'],
  decorators: [
    (Story) => (
      <PublicAuthRouteShell>
        <Story />
      </PublicAuthRouteShell>
    ),
  ],
} satisfies Meta<typeof PatientVerificationView>
export default meta
type Story = StoryObj<typeof meta>
export const Confirmation: Story = {
  args: { state: 'idle' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: copy.confirm }))
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}
export const InvalidLink: Story = { args: { state: 'invalid' } }
export const Confirming: Story = { args: { state: 'pending' } }
export const Retry: Story = { args: { state: 'retry' } }
export const Completed: Story = { args: { state: 'completed' } }

export const InquiryContinuation: Story = {
  args: { state: 'inquiry-continuation' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent(copy.inquiryContinuation)
    await userEvent.click(canvas.getByRole('button', { name: copy.continueAction }))
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}
