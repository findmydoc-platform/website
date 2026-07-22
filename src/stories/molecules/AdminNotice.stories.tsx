import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { ClinicStaffAdminGuidance } from '@/app/(payload)/components/AdminNotice/ClinicStaffAdminGuidance'
import { AdminNotice } from '@/app/(payload)/components/AdminNotice'
import { PlatformStaffAdminGuidance } from '@/app/(payload)/components/AdminNotice/PlatformStaffAdminGuidance'

const meta = {
  title: 'Internal/PayloadAdmin/Molecules/AdminNotice',
  component: AdminNotice,
  args: {
    description: 'Use notices to explain operational context without blocking the current task.',
    title: 'Operational guidance',
  },
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs', 'domain:payload-admin', 'layer:molecule', 'status:stable'],
} satisfies Meta<typeof AdminNotice>

export default meta

type Story = StoryObj<typeof meta>

export const Info: Story = {
  args: {
    variant: 'info',
  },
}

export const Success: Story = {
  args: {
    variant: 'success',
  },
}

export const Warning: Story = {
  args: {
    variant: 'warning',
  },
}

export const Error: Story = {
  args: {
    variant: 'error',
  },
}

export const AllVariants: Story = {
  render: () => (
    <>
      <AdminNotice
        description="Helpful background for the current admin task."
        guideLink={{
          href: '/docs/admin-guide',
          label: 'Open admin guide',
          newTab: true,
        }}
        title="Information"
        variant="info"
      />
      <AdminNotice description="The requested operation completed successfully." title="Success" variant="success" />
      <AdminNotice description="Review this condition before continuing." title="Warning" variant="warning" />
      <AdminNotice description="The operation could not be completed." title="Error" variant="error" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('complementary', { name: 'Information' })).toBeVisible()
    await expect(canvas.getByRole('complementary', { name: 'Success' })).toBeVisible()
    await expect(canvas.getByRole('complementary', { name: 'Warning' })).toBeVisible()
    await expect(canvas.getByRole('complementary', { name: 'Error' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: /open admin guide/i })).toBeVisible()
  },
}

export const WithGuideLink: Story = {
  args: {
    guideLink: {
      href: '/docs/staff-management',
      label: 'Open staff management guide',
      newTab: true,
    },
    variant: 'info',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const guideLink = canvas.getByRole('link', { name: /open staff management guide/i })

    await expect(guideLink).toHaveAttribute('href', '/docs/staff-management')
    await expect(guideLink).toHaveAttribute('target', '_blank')
    await expect(guideLink).toHaveAttribute('rel', 'noreferrer noopener')
  },
}

export const PlatformStaff: Story = {
  render: () => <PlatformStaffAdminGuidance />,
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
