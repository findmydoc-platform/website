import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { RatingFilter } from '@/components/molecules/RatingFilter'
import { sampleClinicRating } from '@/stories/fixtures'

const meta: Meta<typeof RatingFilter> = {
  title: 'Molecules/RatingFilter',
  component: RatingFilter,
}

export default meta

type Story = StoryObj<typeof RatingFilter>

export const Default: Story = {
  args: {},
}

export const WithInitialValue: Story = {
  args: {
    value: sampleClinicRating?.value,
  },
}
