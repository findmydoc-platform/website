import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { within } from '@storybook/testing-library'

import { ListingCard } from '@/components/organisms/Listing'
import { clinicMedia, makeClinic } from '@/stories/fixtures/listings'

const meta: Meta<typeof ListingCard> = {
  title: 'Organisms/ListingCard',
  component: ListingCard,
  parameters: {
    layout: 'centered',
  },
}

export default meta

type Story = StoryObj<typeof ListingCard>

const baseClinic = makeClinic({
  name: 'Istanbul Ortopedi Merkezi',
  location: 'Istanbul · Sisli',
  media: clinicMedia.hospitalExterior,
  rating: { value: 4.8, count: 236 },
  waitTime: '2–3 weeks',
  tags: ['Orthopedics', 'Sports medicine', 'On-site physiotherapy'],
  priceFrom: { label: 'From', value: 8200, currency: 'EUR' },
})

export const AllVariants: Story = {
  render: () => (
    <div className="w-[min(1100px,calc(100vw-2rem))] space-y-4">
      <ListingCard
        data={{
          ...baseClinic,
          rank: 1,
          verification: { variant: 'unverified' },
        }}
      />
      <ListingCard
        data={{
          ...baseClinic,
          rank: 2,
          name: 'Ankara Uroloji Klinigi',
          location: 'Ankara · Cankaya',
          media: clinicMedia.hero,
          rating: { value: 4.6, count: 189 },
          waitTime: '3–4 weeks',
          tags: ['Urology', 'Minimally invasive surgery'],
          priceFrom: { label: 'From', value: 7600, currency: 'EUR' },
          verification: { variant: 'bronze' },
        }}
      />
      <ListingCard
        data={{
          ...baseClinic,
          rank: 3,
          name: 'Izmir Tani Merkezi',
          location: 'Izmir · Konak',
          media: clinicMedia.interior,
          rating: { value: 4.4, count: 142 },
          waitTime: '1–2 weeks',
          tags: ['Diagnostic imaging', 'MRI', 'CT'],
          priceFrom: { label: 'From', value: 5400, currency: 'EUR' },
          verification: { variant: 'silver' },
        }}
      />
      <ListingCard
        data={{
          ...baseClinic,
          rank: 4,
          name: 'Bursa Omurga Klinigi',
          location: 'Bursa · Nilufer',
          media: clinicMedia.consultation,
          rating: { value: 4.9, count: 312 },
          waitTime: '1–2 weeks',
          tags: ['Spine surgery', 'Rehabilitation', 'International patients'],
          priceFrom: { label: 'From', value: 11200, currency: 'EUR' },
          verification: { variant: 'gold' },
        }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const detailsLinks = canvas.getAllByRole('link', { name: 'Details' })
    const compareLinks = canvas.getAllByRole('link', { name: 'Compare' })

    expect(detailsLinks).toHaveLength(4)
    expect(compareLinks).toHaveLength(4)

    detailsLinks.forEach((link) => {
      expect(link).toHaveAttribute('href')
    })

    compareLinks.forEach((link) => {
      expect(link).toHaveAttribute('href')
    })
  },
}

export const LayoutStressTest: Story = {
  render: () => (
    <div className="w-[min(1100px,calc(100vw-2rem))] space-y-4">
      <ListingCard
        data={{
          ...baseClinic,
          rank: 1,
          name: 'Istanbul Universitesi Tip Fakultesi - Ortopedi Anabilim Dali (Capa)',
          location: 'Istanbul · Fatih',
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
          verification: { variant: 'gold' },
        }}
      />
    </div>
  ),
}
