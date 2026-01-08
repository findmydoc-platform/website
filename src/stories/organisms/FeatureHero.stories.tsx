import type { Meta, StoryObj } from '@storybook/react-vite'
import { FeatureHero } from '@/components/organisms/Heroes/FeatureHero'

import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'

const meta = {
  title: 'Organisms/Heroes/FeatureHero',
  component: FeatureHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FeatureHero>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Find the Right Clinic for You',
    subtitle: 'Connect with top-rated medical professionals worldwide.',
    features: ['Verified Clinics', 'Transparent Pricing', 'Patient Reviews', '24/7 Support'],
    media: {
      src: clinicHospitalExterior,
      alt: 'Medical Hero',
    },
    bulletStyle: 'circle',
  },
}

export const NoMedia: Story = {
  args: {
    title: 'Simple & Transparent',
    subtitle: 'No hidden fees, just great healthcare.',
    features: ['Free Consultation', 'Direct Booking'],
    media: undefined,
    bulletStyle: 'both',
  },
}
