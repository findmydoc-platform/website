import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { AdminBar } from '@/components/organisms/AdminBar'

const meta = {
  title: 'Domain/Platform/Organisms/AdminBar',
  component: AdminBar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test', 'domain:platform', 'layer:organism', 'status:stable', 'used-in:block:admin-bar'],
} satisfies Meta<typeof AdminBar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /log out/i })).toBeInTheDocument()
    })

    const adminBar = canvasElement.querySelector('.admin-bar')

    expect(adminBar).toBeInTheDocument()
    await waitFor(() => {
      expect(adminBar).toBeVisible()
    })

    await userEvent.click(canvas.getByRole('button', { name: /log out/i }))

    await waitFor(() => {
      expect(adminBar).not.toBeVisible()
    })
  },
}
