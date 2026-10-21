import type { CSSProperties } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ClinicGroupMovementPanel } from './Panel'

const meta = {
  title: 'Domain/Clinics/Organisms/GroupMovement',
  component: ClinicGroupMovementPanel,
  parameters: { nextjs: { appDirectory: false } },
  tags: ['autodocs', 'domain:clinics', 'layer:organism', 'status:stable', 'used-in:route:/admin/collections/clinics'],
  args: {
    sourceGroupId: 1,
    groups: [
      { id: 1, name: 'Current network' },
      { id: 2, name: 'Destination clinic network with a long display name' },
    ],
    onMove: fn(async () => {}),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClinicGroupMovementPanel>
export default meta
type Story = StoryObj<typeof meta>
export const Transfer: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Move clinic' })).toBeDisabled()
    await userEvent.selectOptions(canvas.getByLabelText('Destination'), '2')
    await userEvent.click(canvas.getByRole('checkbox'))
    await userEvent.click(canvas.getByRole('button', { name: 'Move clinic' }))
    await expect(args.onMove).toHaveBeenCalledWith(2)
  },
}
export const Detach: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.selectOptions(canvas.getByLabelText('Destination'), 'independent')
    await userEvent.click(canvas.getByRole('checkbox'))
    await userEvent.click(canvas.getByRole('button', { name: 'Move clinic' }))
    await expect(args.onMove).toHaveBeenCalledWith(null)
  },
}
export const UnsavedClinic: Story = { args: { dirty: true } }
export const Pending: Story = { args: { busy: true } }
export const MembershipChanged: Story = {
  args: { error: 'Clinic group membership changed. Reload before trying again.' },
}

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
