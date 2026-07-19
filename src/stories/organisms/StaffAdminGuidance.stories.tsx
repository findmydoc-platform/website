import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { ClinicStaffAdminGuidance, PlatformStaffAdminGuidance } from '@/components/organisms/StaffAdminGuidance'

const meta = {
  title: 'Internal/PayloadAdmin/Organisms/StaffAdminGuidance',
  component: PlatformStaffAdminGuidance,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs', 'domain:payload-admin', 'layer:organism', 'status:stable', 'used-in:shared'],
} satisfies Meta<typeof PlatformStaffAdminGuidance>

export default meta

type Story = StoryObj<typeof meta>

export const PlatformStaff: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Managed platform account')).toBeVisible()
    await expect(canvas.getByText(/account creation and deletion are intentionally unavailable/i)).toBeVisible()
  },
}

export const ClinicStaff: Story = {
  render: () => <ClinicStaffAdminGuidance />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Managed clinic account')).toBeVisible()
    await expect(canvas.getByText(/clinic assignment, and approval status/i)).toBeVisible()
  },
}
