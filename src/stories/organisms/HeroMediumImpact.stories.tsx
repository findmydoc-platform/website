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
  args: {
    richText: <p>findmydoc connects patients with trusted clinics across specialties.</p>,
    media: {
      src:
        sampleMediumImpactHero.media && typeof sampleMediumImpactHero.media === 'object'
          ? sampleMediumImpactHero.media.url || ''
          : '',
      alt:
        sampleMediumImpactHero.media && typeof sampleMediumImpactHero.media === 'object'
          ? sampleMediumImpactHero.media.alt || ''
          : '',
      width:
        sampleMediumImpactHero.media && typeof sampleMediumImpactHero.media === 'object'
          ? sampleMediumImpactHero.media.width || undefined
          : undefined,
      height:
        sampleMediumImpactHero.media && typeof sampleMediumImpactHero.media === 'object'
          ? sampleMediumImpactHero.media.height || undefined
          : undefined,
    },
    links: [],
  },
}
