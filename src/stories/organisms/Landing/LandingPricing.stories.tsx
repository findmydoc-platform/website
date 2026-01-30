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
    title: 'Pricing',
    description: 'Our pricing model is transparent and designed for clinics of different sizes.',
  },
} satisfies Meta<typeof LandingPricing>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
