import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { LandingPricing } from '@/components/organisms/Landing'
import { clinicPricingData, clinicPricingModelItems } from '@/stories/fixtures/listings'
import { withViewportStory } from '../../utils/viewportMatrix'

const meta = {
  title: 'Domain/Landing/Organisms/LandingPricing',
  component: LandingPricing,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:stable', 'used-in:block:landing-pricing'],
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

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Pricing')).toBeInTheDocument()
    await expect(canvas.getByText('Premium')).toBeInTheDocument()
    await expect(canvas.getByText('EUR 199')).toBeInTheDocument()
    await expect(canvas.getByText('EUR 349')).toBeInTheDocument()
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')
