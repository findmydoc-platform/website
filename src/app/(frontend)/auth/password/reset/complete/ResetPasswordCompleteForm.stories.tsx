import { authCopySentences } from '@/features/uiCopy/patientAuthPresentation'
import type { Meta, StoryObj } from '@storybook/react-vite'
import en from '@findmydoc-platform/ui-copy/en.json'
import { expect, fn, userEvent, within } from 'storybook/test'
import { RecoveryPasswordView, type RecoveryPasswordResult } from './ResetPasswordCompleteForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'

const catalog = en.auth.passwordRecovery
const meta = {
  title: 'Domain/Auth/Pages/RecoveryPassword',
  component: RecoveryPasswordView,
  args: {
    available: true,
    copy: {
      ...catalog.completion,
      passwordHint: catalog.completion.shortPassword,
      shared: {
        invalidTitle: authCopySentences(catalog.shared.invalidLink, 'en')[0]!,
        invalidLink: catalog.shared.invalidLink,
        retry: catalog.shared.retry,
        requestLink: { href: '/en/auth/password/reset', label: catalog.shared.requestLink },
      },
    },
    onComplete: fn(async (): Promise<RecoveryPasswordResult> => 'completed'),
  },
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
    await expect(canvas.getByRole('status')).toBeVisible()
  },
}
export const InvalidLink: Story = { args: { available: false } }
export const Retry: Story = {
  args: { initialState: 'retry', onComplete: fn(async (): Promise<RecoveryPasswordResult> => 'retry') },
}
export const Resume: Story = { args: { resume: true } }
export const Completed: Story = { args: { initialState: 'completed' } }

export const InquiryContinuation: Story = {
  args: { initialState: 'inquiry-continuation' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toBeVisible()
    await expect(canvasElement.querySelectorAll('input[type="password"]')).toHaveLength(0)
    await userEvent.click(canvas.getByRole('button', { name: 'Continue saved inquiries' }))
    await expect(args.onComplete).toHaveBeenCalledWith({})
  },
}
