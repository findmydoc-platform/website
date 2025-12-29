import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { PriceSummary } from '@/components/molecules/PriceSummary'

const meta = {
  title: 'Molecules/PriceSummary',
  component: PriceSummary,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PriceSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    priceFrom: {
      value: 3500,
      currency: 'EUR',
      label: 'From',
    },
    className: 'rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-4',
  },
}

export const UsdCurrency: Story = {
  args: {
    priceFrom: {
      value: 4200,
      currency: 'USD',
      label: 'Starting at',
    },
  },
}
