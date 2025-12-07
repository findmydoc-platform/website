import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { LowImpactHero } from '@/components/organisms/Heroes/LowImpact'
import { sampleLowImpactHero } from './fixtures'

const meta = {
  title: 'Organisms/Heroes/LowImpactHero',
  component: LowImpactHero,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LowImpactHero>

export default meta

type Story = StoryObj<typeof meta>

export const RichTextOnly: Story = {
  args: {
    ...sampleLowImpactHero,
  },
}
