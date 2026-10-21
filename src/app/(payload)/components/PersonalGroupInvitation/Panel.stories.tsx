import type { CSSProperties } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PersonalGroupInvitationPanel } from './Panel'
const meta = {
  title: 'Domain/Clinics/Organisms/PersonalGroupInvitation',
  component: PersonalGroupInvitationPanel,
  parameters: { nextjs: { appDirectory: false } },
  tags: [
    'autodocs',
    'domain:clinics',
    'layer:organism',
    'status:stable',
    'used-in:route:/admin/collections/clinicGroups',
  ],
  args: { onInvite: fn(async () => {}) },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PersonalGroupInvitationPanel>
export default meta
type Story = StoryObj<typeof meta>
export const PersonalInvitation: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Prepare personal invitation' })).toBeDisabled()
    const email = canvas.getByLabelText('Personal email')
    await userEvent.type(email, 'invalid')
    await userEvent.tab()
    await expect(email).toHaveAccessibleDescription('Enter a valid personal email address.')
    await userEvent.clear(email)
    await userEvent.type(email, 'manager@example.test')
    await expect(canvas.queryByText('Enter a valid personal email address.')).not.toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText('First name'), 'New')
    await userEvent.type(canvas.getByLabelText('Last name'), 'Manager')
    await userEvent.click(canvas.getByRole('checkbox'))
    await userEvent.click(canvas.getByRole('button', { name: 'Prepare personal invitation' }))
    await expect(args.onInvite).toHaveBeenCalledWith({
      email: 'manager@example.test',
      firstName: 'New',
      lastName: 'Manager',
    })
  },
}
export const Unconfirmed: Story = {
  args: { error: 'Identity preparation is unconfirmed. Retry the same personal invitation.' },
}
export const DeliveryInactive: Story = {
  args: { result: 'The personal account is prepared. Invitation delivery is inactive in this environment.' },
}
export const Pending: Story = { args: { busy: true } }
export const UnsavedGroup: Story = { args: { dirty: true } }
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div
        style={
          {
            '--theme-bg': '#171717',
            '--theme-text': '#f4f4f4',
            '--theme-input-bg': '#242424',
            '--theme-elevation-200': '#555',
            '--theme-elevation-400': '#999',
          } as CSSProperties
        }
      >
        <Story />
      </div>
    ),
  ],
}
