import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { HighImpactHero } from '@/components/organisms/Heroes/HighImpact'
import { sampleHighImpactHero } from './fixtures'

const meta = {
  title: 'Organisms/Heroes/HighImpactHero',
  component: HighImpactHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HighImpactHero>

export default meta

type Story = StoryObj<typeof meta>

export const WithBackgroundImage: Story = {
  args: {
    ...sampleHighImpactHero,
  },
}
