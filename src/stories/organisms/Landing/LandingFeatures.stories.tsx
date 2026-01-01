import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { LandingFeatures } from '@/components/organisms/Landing'
import { clinicFeaturesData } from '@/stories/fixtures/listings'
import ph1440x900 from '@/stories/assets/placeholder-1440-900.png'

const meta = {
  title: 'Organisms/Landing/LandingFeatures',
  component: LandingFeatures,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    features: clinicFeaturesData,
  },
} satisfies Meta<typeof LandingFeatures>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const GreenVariant: Story = {
  args: {
    variant: 'green',
    backgroundImage: ph1440x900,
  },
}
