import type { Meta, StoryObj } from '@storybook/nextjs-vite'

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

export const Default: Story = {}
