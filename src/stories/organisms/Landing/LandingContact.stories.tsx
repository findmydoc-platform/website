import type { Meta, StoryObj } from '@storybook/react-vite'

import { LandingContact } from '@/components/organisms/Landing'

const meta = {
  title: 'Organisms/Landing/LandingContact',
  component: LandingContact,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LandingContact>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
