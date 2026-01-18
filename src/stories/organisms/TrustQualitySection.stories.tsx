import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from '@storybook/jest'
import { within } from '@storybook/testing-library'

import { TrustQualitySection } from '@/components/organisms/TrustQualitySection'
import { formatTrustQualityStatValue } from '@/components/organisms/TrustQualitySection'
import { clinicTrust } from '@/stories/fixtures'

const meta = {
  title: 'Organisms/TrustQualitySection',
  component: TrustQualitySection,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: clinicTrust,
} satisfies Meta<typeof TrustQualitySection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText(args.title)).toBeInTheDocument()
    if (args.subtitle) {
      expect(canvas.getByText(args.subtitle)).toBeInTheDocument()
    }

    for (const stat of args.stats) {
      const expectedValueText = 'value' in stat ? formatTrustQualityStatValue(stat) : stat.valueText
      await expect(canvas.findByText(expectedValueText)).resolves.toBeInTheDocument()
      expect(canvas.getByText(stat.label)).toBeInTheDocument()
    }

    if (args.badges) {
      args.badges.forEach((badge) => {
        expect(canvas.getByText(badge)).toBeInTheDocument()
      })
    }
  },
}
