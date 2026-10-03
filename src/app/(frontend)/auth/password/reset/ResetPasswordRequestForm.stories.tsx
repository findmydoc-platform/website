import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ResetPasswordRequestForm } from './ResetPasswordRequestForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'

const meta = {
  title: 'Domain/Auth/Pages/RecoveryRequest',
  component: ResetPasswordRequestForm,
  args: { onRequest: fn(async () => {}) },
  tags: ['autodocs', 'domain:auth', 'layer:page', 'status:stable', 'used-in:route:/auth/password/reset'],
  decorators: [
    (Story) => (
      <PublicAuthRouteShell>
        <Story />
      </PublicAuthRouteShell>
    ),
  ],
} satisfies Meta<typeof ResetPasswordRequestForm>
export default meta
type Story = StoryObj<typeof meta>
export const Request: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Send reset instructions' }))
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email' }), 'principal@example.test')
    await userEvent.click(canvas.getByRole('button', { name: 'Send reset instructions' }))
    await expect(args.onRequest).toHaveBeenCalledOnce()
    await expect(canvas.getByRole('status')).toHaveTextContent('If the email exists')
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveValue('')
  },
}
export const Expired: Story = { args: { reason: 'expired' } }
