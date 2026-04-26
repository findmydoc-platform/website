import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { ListingCard } from '@/components/organisms/Listing'
import { clinicMedia, makeClinic } from '@/stories/fixtures/listings'
import { withViewportStory } from '../utils/viewportMatrix'

const meta: Meta<typeof ListingCard> = {
  title: 'Domain/Listing/Organisms/ListingCard',
  component: ListingCard,
  tags: ['autodocs', 'domain:listing', 'layer:organism', 'status:stable', 'used-in:block:listing-card'],
  parameters: {
    layout: 'centered',
  },
}

export default meta

type Story = StoryObj<typeof ListingCard>

const baseClinic = makeClinic({
  id: 'story-clinic-base',
  name: 'Istanbul Ortopedi Merkezi',
  location: 'Istanbul · Sisli',
  media: clinicMedia.hospitalExterior,
  rating: { value: 4.8, count: 236 },
  waitTime: { label: '2–3 weeks', minWeeks: 2, maxWeeks: 3 },
  tags: ['Orthopedics', 'Sports medicine', 'On-site physiotherapy'],
  priceFrom: { label: 'From', value: 8200, currency: 'EUR' },
})

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <ListingCard
        data={{
          ...baseClinic,
          id: 'story-clinic-1',
          verification: { variant: 'unverified' },
        }}
      />
      <ListingCard
        data={{
          ...baseClinic,
          id: 'story-clinic-2',
          name: 'Ankara Uroloji Klinigi',
          location: 'Ankara · Cankaya',
          media: clinicMedia.hero,
          rating: { value: 4.6, count: 189 },
          waitTime: { label: '3–4 weeks', minWeeks: 3, maxWeeks: 4 },
          tags: ['Urology', 'Minimally invasive surgery'],
          priceFrom: { label: 'From', value: 7600, currency: 'EUR' },
          verification: { variant: 'bronze' },
        }}
      />
      <ListingCard
        data={{
          ...baseClinic,
          id: 'story-clinic-3',
          name: 'Izmir Tani Merkezi',
          location: 'Izmir · Konak',
          media: clinicMedia.interior,
          rating: { value: 4.4, count: 142 },
          waitTime: { label: '1–2 weeks', minWeeks: 1, maxWeeks: 2 },
          tags: ['Diagnostic imaging', 'MRI', 'CT'],
          priceFrom: { label: 'From', value: 5400, currency: 'EUR' },
          verification: { variant: 'silver' },
        }}
      />
      <ListingCard
        data={{
          ...baseClinic,
          id: 'story-clinic-4',
          name: 'Bursa Omurga Klinigi',
          location: 'Bursa · Nilufer',
          media: clinicMedia.consultation,
          rating: { value: 4.9, count: 312 },
          waitTime: { label: '1–2 weeks', minWeeks: 1, maxWeeks: 2 },
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
    <div className="space-y-4">
      <ListingCard
        data={{
          ...baseClinic,
          id: 'story-clinic-stress',
          name: 'Istanbul Universitesi Tip Fakultesi - Ortopedi Anabilim Dali (Capa)',
          location: 'Istanbul · Fatih',
          rating: { value: 4.8, count: 236 },
          waitTime: { label: '2–3 weeks', minWeeks: 2, maxWeeks: 3 },
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText(/Istanbul Universitesi Tip Fakultesi/i)).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Details' })).toHaveAttribute('href')
    await expect(canvas.getByRole('link', { name: 'Compare' })).toHaveAttribute('href')
  },
}

export const LayoutStress320: Story = withViewportStory(LayoutStressTest, 'public320', 'Layout stress / 320')
export const LayoutStress375: Story = withViewportStory(LayoutStressTest, 'public375', 'Layout stress / 375')
export const LayoutStress640: Story = withViewportStory(LayoutStressTest, 'public640', 'Layout stress / 640')
export const LayoutStress768: Story = withViewportStory(LayoutStressTest, 'public768', 'Layout stress / 768')
export const LayoutStress1024: Story = withViewportStory(LayoutStressTest, 'public1024', 'Layout stress / 1024')
export const LayoutStress1280: Story = withViewportStory(LayoutStressTest, 'public1280', 'Layout stress / 1280')
