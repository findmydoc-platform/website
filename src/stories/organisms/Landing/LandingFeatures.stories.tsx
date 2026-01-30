import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { LandingFeatures } from '@/components/organisms/Landing'
import { clinicFeaturesData } from '@/stories/fixtures/listings'
import ph1440x900 from '@/stories/assets/placeholder-1440-900.svg'

const meta = {
  title: 'Organisms/Landing/LandingFeatures',
  component: LandingFeatures,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
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
}
