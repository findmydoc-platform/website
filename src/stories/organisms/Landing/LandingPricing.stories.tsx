import type { Meta, StoryObj } from '@storybook/react-vite'

import { LandingPricing } from '@/components/organisms/Landing'
import { clinicPricingData } from '@/stories/fixtures/listings'

const meta = {
  title: 'Organisms/Landing/LandingPricing',
  component: LandingPricing,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    plans: clinicPricingData,
  },
} satisfies Meta<typeof LandingPricing>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
