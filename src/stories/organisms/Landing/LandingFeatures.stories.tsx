import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { LandingFeatures } from '@/components/organisms/Landing'
import { clinicFeaturesData } from '@/stories/fixtures/listings'

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
