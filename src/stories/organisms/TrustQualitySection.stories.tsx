import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from '@storybook/jest'
import { within } from '@storybook/testing-library'

import { TrustQualitySection } from '@/components/organisms/TrustQualitySection'
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

    args.stats.forEach(({ value, label }) => {
      expect(canvas.getByText(value)).toBeInTheDocument()
      expect(canvas.getByText(label)).toBeInTheDocument()
    })

    if (args.badges) {
      args.badges.forEach((badge) => {
        expect(canvas.getByText(badge)).toBeInTheDocument()
      })
    }
  },
}
