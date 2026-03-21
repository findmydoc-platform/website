import type { Meta, StoryObj } from '@storybook/react-vite'

import { LandingPricing } from '@/components/organisms/Landing'
import { clinicPricingData, clinicPricingModelItems } from '@/stories/fixtures/listings'

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
    description:
      'Three monthly tiers for different growth stages, plus performance-based commission on successful cases.',
    modelItems: clinicPricingModelItems,
  },
} satisfies Meta<typeof LandingPricing>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
