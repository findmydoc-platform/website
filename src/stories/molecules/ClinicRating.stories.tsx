import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ClinicRating } from '@/components/molecules/ClinicRating'

const meta = {
  title: 'Molecules/ClinicRating',
  component: ClinicRating,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ClinicRating>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 4.6,
    count: 189,
  },
}

export const LowRating: Story = {
  args: {
    value: 2.1,
    count: 12,
  },
}

export const Perfect: Story = {
  args: {
    value: 5,
    count: 1024,
  },
}
