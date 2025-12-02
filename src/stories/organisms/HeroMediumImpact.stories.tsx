import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MediumImpactHero } from '@/components/organisms/Heroes/MediumImpact'
import { sampleMediumImpactHero } from './fixtures'

const meta = {
  title: 'Organisms/Heroes/MediumImpactHero',
  component: MediumImpactHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MediumImpactHero>

export default meta

type Story = StoryObj<typeof meta>

export const WithCaptionedImage: Story = {
  args: sampleMediumImpactHero,
}
