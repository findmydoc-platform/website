import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ClinicLandingHero } from '@/components/organisms/Heroes/ClinicLanding'
import ph1440x900 from '@/stories/assets/placeholder-1440-900.png'

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
    image: ph1440x900.src,
    socialLinks: [],
    showScrollIndicator: true,
  },
}
