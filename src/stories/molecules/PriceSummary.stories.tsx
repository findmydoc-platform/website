import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { PriceSummary } from '@/components/molecules/PriceSummary'
import { makeClinic, sampleClinicPriceFrom } from '@/stories/fixtures'

const meta = {
  title: 'Molecules/PriceSummary',
  component: PriceSummary,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof PriceSummary>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    priceFrom: sampleClinicPriceFrom,
  },
}

export const LowPrice: Story = {
  args: {
    priceFrom: makeClinic({ priceFrom: { label: 'From', value: 1200, currency: 'EUR' } }).priceFrom,
  },
}

export const HighPrice: Story = {
  args: {
    priceFrom: makeClinic({ priceFrom: { label: 'From', value: 19500, currency: 'EUR' } }).priceFrom,
  },
}

export const DifferentCurrency: Story = {
  args: {
    priceFrom: makeClinic({ priceFrom: { label: 'Starting at', value: 8500, currency: 'USD' } }).priceFrom,
  },
}
