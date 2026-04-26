import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { LandingFeatures } from '@/components/organisms/Landing'
import { clinicFeaturesData } from '@/stories/fixtures/listings'
import { withViewportStory } from '../../utils/viewportMatrix'
import ph1440x900 from '../../assets/placeholder-1440-900.svg'

const meta = {
  title: 'Domain/Landing/Organisms/LandingFeatures',
  component: LandingFeatures,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:stable', 'used-in:block:landing-features'],
  args: {
    features: clinicFeaturesData,
    title: 'Why partner with us',
    description:
      "Increase your clinic's visibility, attract qualified patients, and grow internationally through transparent, verified profiles.",
  },
} satisfies Meta<typeof LandingFeatures>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

const featuresWithoutSubtitles = clinicFeaturesData.map(({ subtitle: _subtitle, ...rest }) => rest)

export const NoSubtitles: Story = {
  args: {
    features: featuresWithoutSubtitles,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryAllByRole('heading', { level: 4 })).toHaveLength(0)
    await expect(canvas.queryAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0)
  },
}

export const GreenVariant: Story = {
  args: {
    variant: 'green',
    backgroundImage: ph1440x900,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Why partner with us' })).toBeInTheDocument()
    await expect(canvas.getByText('Qualified Leads')).toBeInTheDocument()
    await expect(canvas.getByText('Reputation Boost')).toBeInTheDocument()
  },
}

export const GreenVariant320: Story = withViewportStory(GreenVariant, 'public320', 'Green variant / 320')
export const GreenVariant375: Story = withViewportStory(GreenVariant, 'public375', 'Green variant / 375')
export const GreenVariant640: Story = withViewportStory(GreenVariant, 'public640', 'Green variant / 640')
export const GreenVariant768: Story = withViewportStory(GreenVariant, 'public768', 'Green variant / 768')
export const GreenVariant1024: Story = withViewportStory(GreenVariant, 'public1024', 'Green variant / 1024')
export const GreenVariant1280: Story = withViewportStory(GreenVariant, 'public1280', 'Green variant / 1280')
