import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ClinicResultCard, type ClinicResultCardData } from '@/components/organisms/ClinicResultCard'
import medicalHero from '@/stories/assets/medical-hero.jpg'

const meta: Meta<typeof ClinicResultCard> = {
  title: 'Organisms/ClinicResultCard',
  component: ClinicResultCard,
  parameters: {
    layout: 'centered',
  },
}

export default meta

type Story = StoryObj<typeof ClinicResultCard>

const baseData: Omit<ClinicResultCardData, 'verification'> = {
  rank: 2,
  name: 'Klinikum München',
  location: 'Munich Schwabing',
  media: {
    src: medicalHero.src,
    alt: 'Clinic exterior',
  },
  rating: {
    value: 4.6,
    count: 189,
  },
  waitTime: '3–4 weeks',
  tags: ['Specialized orthopedics', 'Short wait times', 'On-site physiotherapy'],
  priceFrom: {
    label: 'From',
    value: 7800,
    currency: 'EUR',
  },
  actions: {
    details: { href: '#', label: 'Details' },
    compare: { href: '#', label: 'Compare' },
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="w-[min(1100px,calc(100vw-2rem))] space-y-4">
      <ClinicResultCard data={{ ...baseData, verification: { variant: 'notVerified', label: 'Not verified' } }} />
      <ClinicResultCard data={{ ...baseData, verification: { variant: 'bronze', label: 'Verified' } }} />
      <ClinicResultCard data={{ ...baseData, verification: { variant: 'silver', label: 'Verified' } }} />
      <ClinicResultCard data={{ ...baseData, verification: { variant: 'gold', label: 'Verified' } }} />
    </div>
  ),
}
