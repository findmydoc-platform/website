import type { Meta, StoryObj } from '@storybook/react-vite'
import { FeatureHero } from '@/components/organisms/Heroes/FeatureHero'

import { storyClinicImages } from '../fixtures/assets'

const meta = {
  title: 'Domain/Listing/Organisms/Heroes/FeatureHero',
  component: FeatureHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:listing', 'layer:organism', 'status:stable', 'used-in:route:/listing-comparison'],
} satisfies Meta<typeof FeatureHero>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Find the Right Clinic for You',
    subtitle: 'Compare clinic-provided profiles, listed services, and contact options worldwide.',
    features: ['Clinic Profiles', 'Listed Price Fields', 'Direct Contact', 'Service Details'],
    media: {
      src: storyClinicImages.listing.exterior,
      alt: 'Medical Hero',
    },
    bulletStyle: 'circle',
  },
}

export const NoMedia: Story = {
  args: {
    title: 'Simple & Transparent',
    subtitle: 'Structured information for visual testing.',
    features: ['Profile Details', 'Contact Paths'],
    media: undefined,
    bulletStyle: 'both',
  },
}
