import type { Meta, StoryObj } from '@storybook/react-vite'

import { RatingSummary } from '@/components/molecules/RatingSummary'
import { makeClinic, sampleClinicRating } from '@/stories/fixtures'

const meta = {
  title: 'Molecules/RatingSummary',
  component: RatingSummary,
  tags: ['autodocs'],
} satisfies Meta<typeof RatingSummary>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: sampleClinicRating?.value ?? 4.7,
    count: sampleClinicRating?.count ?? 222,
  },
}

export const LowRating: Story = {
  args: {
    value: makeClinic({ rating: { value: 2.1, count: 12 } }).rating?.value,
    count: makeClinic({ rating: { value: 2.1, count: 12 } }).rating?.count,
  },
}

export const Perfect: Story = {
  args: {
    value: makeClinic({ rating: { value: 5, count: 1024 } }).rating?.value,
    count: makeClinic({ rating: { value: 5, count: 1024 } }).rating?.count,
  },
}

export const StackedReviews: Story = {
  args: {
    value: 4.8,
    count: 211,
    variant: 'stacked',
    countFormat: 'reviews',
  },
}
