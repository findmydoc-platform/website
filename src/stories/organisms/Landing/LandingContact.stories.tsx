import type { Meta, StoryObj } from '@storybook/react-vite'

import { LandingContact } from '@/components/organisms/Landing'

const meta = {
  title: 'Organisms/Landing/LandingContact',
  component: LandingContact,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    title: 'Contact',
    description: 'Reach out to learn how we can help your clinic grow.',
  },
} satisfies Meta<typeof LandingContact>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
