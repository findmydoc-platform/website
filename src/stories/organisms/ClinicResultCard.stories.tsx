import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ClinicResultCard, type ClinicResultCardData } from '@/components/organisms/ClinicResultCard'
import medicalHero from '@/stories/assets/medical-hero.jpg'
import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'
import clinicConsultation from '@/stories/assets/clinic-consultation.jpg'
import clinicInterior from '@/stories/assets/content-clinic-interior.jpg'

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
  rank: 1,
  name: 'Istanbul Ortopedi Merkezi',
  location: 'Istanbul · Sisli',
  media: {
    src: medicalHero.src,
    alt: 'Medical team walking through a bright clinic corridor',
  },
  rating: {
    value: 4.8,
    count: 236,
  },
  waitTime: '2–3 weeks',
  tags: ['Orthopedics', 'Sports medicine', 'On-site physiotherapy'],
  priceFrom: {
    label: 'From',
    value: 8200,
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
      <ClinicResultCard
        data={{
          ...baseData,
          rank: 1,
          name: 'Istanbul Ortopedi Merkezi',
          location: 'Istanbul · Sisli',
          media: {
            src: clinicHospitalExterior.src,
            alt: 'Modern hospital exterior with clear clinic signage',
          },
          rating: { value: 4.8, count: 236 },
          waitTime: '2–3 weeks',
          tags: ['Orthopedics', 'Sports medicine', 'On-site physiotherapy'],
          priceFrom: {
            label: 'From',
            value: 8200,
            currency: 'EUR',
          },
          verification: { variant: 'unverified' },
        }}
      />
      <ClinicResultCard
        data={{
          ...baseData,
          rank: 2,
          name: 'Ankara Uroloji Klinigi',
          location: 'Ankara · Cankaya',
          media: {
            src: medicalHero.src,
            alt: 'Medical team walking through a hospital corridor',
          },
          rating: { value: 4.6, count: 189 },
          waitTime: '3–4 weeks',
          tags: ['Urology', 'Minimally invasive surgery'],
          priceFrom: {
            label: 'From',
            value: 7600,
            currency: 'EUR',
          },
          verification: { variant: 'bronze' },
        }}
      />
      <ClinicResultCard
        data={{
          ...baseData,
          rank: 3,
          name: 'Izmir Tani Merkezi',
          location: 'Izmir · Konak',
          media: {
            src: clinicInterior.src,
            alt: 'Bright clinic interior corridor with seating area',
          },
          rating: { value: 4.4, count: 142 },
          waitTime: '1–2 weeks',
          tags: ['Diagnostic imaging', 'MRI', 'CT'],
          priceFrom: {
            label: 'From',
            value: 5400,
            currency: 'EUR',
          },
          verification: { variant: 'silver' },
        }}
      />
      <ClinicResultCard
        data={{
          ...baseData,
          rank: 4,
          name: 'Bursa Omurga Klinigi',
          location: 'Bursa · Nilufer',
          media: {
            src: clinicConsultation.src,
            alt: 'Doctor consulting with a patient in a modern clinic room',
          },
          rating: { value: 4.9, count: 312 },
          waitTime: '1–2 weeks',
          tags: ['Spine surgery', 'Rehabilitation', 'International patients'],
          priceFrom: {
            label: 'From',
            value: 11200,
            currency: 'EUR',
          },
          verification: { variant: 'gold' },
        }}
      />
    </div>
  ),
}

export const LayoutStressTest: Story = {
  render: () => (
    <div className="w-[min(1100px,calc(100vw-2rem))] space-y-4">
      <ClinicResultCard
        data={{
          ...baseData,
          rank: 1,
          name: 'Istanbul Universitesi Tip Fakultesi - Ortopedi Anabilim Dali (Capa)',
          location: 'Istanbul · Fatih',
          media: {
            src: medicalHero.src,
            alt: 'Hospital exterior',
          },
          rating: { value: 4.8, count: 236 },
          waitTime: '2–3 weeks',
          tags: [
            'Orthopedics',
            'Sports medicine',
            'On-site physiotherapy',
            'Rehabilitation',
            'Minimally invasive surgery',
            'International patients',
            'Emergency care',
          ],
          priceFrom: {
            label: 'From',
            value: 8200,
            currency: 'EUR',
          },
          verification: { variant: 'gold' },
        }}
      />
    </div>
  ),
}
