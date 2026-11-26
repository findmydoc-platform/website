import { authCopySentences } from '@/features/uiCopy/patientAuthPresentation'
import type { Meta, StoryObj } from '@storybook/react-vite'
import en from '@findmydoc-platform/ui-copy/en.json'
import { expect, fn, userEvent, within } from 'storybook/test'
import { RecoveryConfirmationView } from './RecoveryConfirmationForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'

const catalog = en.auth.passwordRecovery
const meta = {
  title: 'Domain/Auth/Pages/RecoveryConfirmation',
  component: RecoveryConfirmationView,
  args: {
    copy: {
      ...catalog.confirmation,
      shared: {
        invalidTitle: authCopySentences(catalog.shared.invalidLink, 'en')[0]!,
        invalidLink: catalog.shared.invalidLink,
        retry: catalog.shared.retry,
        requestLink: { href: '/en/auth/password/reset', label: catalog.shared.requestLink },
      },
    },
    onConfirm: fn(),
  },
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
