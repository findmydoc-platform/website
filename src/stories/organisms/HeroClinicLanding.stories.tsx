import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ClinicLandingHero } from '@/components/organisms/Heroes/ClinicLanding'

const meta = {
  title: 'Organisms/Heroes/ClinicLandingHero',
  component: ClinicLandingHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ClinicLandingHero>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'The best solution for your clinic',
    description: 'Join findmydoc and connect with patients worldwide.',
    image: 'https://placehold.co/1440x900.png',
    socialLinks: [],
    showScrollIndicator: true,
  },
}
