import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { LandingContact } from '@/components/organisms/Landing'

const meta = {
  title: 'Domain/Landing/Organisms/Landing/LandingContact',
  component: LandingContact,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:stable', 'used-in:block:landing-contact'],
  args: {
    title: 'Contact',
    description: 'Reach out to learn how we can help your clinic grow.',
  },
} satisfies Meta<typeof LandingContact>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText('Name')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Email')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Message')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeInTheDocument()
  },
}
