import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { RecoveryConfirmationView } from './RecoveryConfirmationForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'

const meta = {
  title: 'Domain/Auth/Pages/RecoveryConfirmation',
  component: RecoveryConfirmationView,
  args: { onConfirm: fn() },
  tags: ['autodocs', 'domain:auth', 'layer:page', 'status:stable', 'used-in:route:/auth/confirm'],
  decorators: [
    (Story) => (
      <PublicAuthRouteShell>
        <Story />
      </PublicAuthRouteShell>
    ),
  ],
} satisfies Meta<typeof RecoveryConfirmationView>
export default meta
type Story = StoryObj<typeof meta>
export const Confirmation: Story = {
  args: { state: 'idle' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Confirm recovery' }))
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}
export const InvalidLink: Story = { args: { state: 'invalid' } }
export const Confirming: Story = { args: { state: 'pending' } }
export const Retry: Story = { args: { state: 'retry' } }
export const Completed: Story = { args: { state: 'completed' } }
