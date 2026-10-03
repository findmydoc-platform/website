import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { RecoveryPasswordView, type RecoveryPasswordResult } from './ResetPasswordCompleteForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'

const meta = {
  title: 'Domain/Auth/Pages/RecoveryPassword',
  component: RecoveryPasswordView,
  args: { available: true, onComplete: fn(async (): Promise<RecoveryPasswordResult> => 'completed') },
  tags: ['autodocs', 'domain:auth', 'layer:page', 'status:stable', 'used-in:route:/auth/password/reset/complete'],
  decorators: [
    (Story) => (
      <PublicAuthRouteShell>
        <Story />
      </PublicAuthRouteShell>
    ),
  ],
} satisfies Meta<typeof RecoveryPasswordView>
export default meta
type Story = StoryObj<typeof meta>
export const Password: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Update password' }))
    await expect(canvas.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(canvas.getByLabelText('New password'), 'OfflinePassword123') // pragma: allowlist secret
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'OfflinePassword123') // pragma: allowlist secret
    await userEvent.click(canvas.getByRole('button', { name: 'Update password' }))
    await expect(args.onComplete).toHaveBeenCalledOnce()
    await expect(canvas.getByRole('status')).toHaveTextContent('Password recovery complete')
  },
}
export const InvalidLink: Story = { args: { available: false } }
export const Retry: Story = {
  args: { initialState: 'retry', onComplete: fn(async (): Promise<RecoveryPasswordResult> => 'retry') },
}
export const Resume: Story = { args: { resume: true } }
export const Completed: Story = { args: { initialState: 'completed' } }
