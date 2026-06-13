import type { Meta, StoryObj } from '@storybook/react-vite'

import { RatingSummary } from '@/components/molecules/RatingSummary'

const meta = {
  title: 'Shared/Molecules/RatingSummary',
  component: RatingSummary,
  parameters: {
    docs: {
      description: {
        component:
          'MVP-safe Storybook coverage renders only the empty visual state. Populated rating examples stay out of public fixtures until the verification process is defined.',
      },
    },
  },
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
} satisfies Meta<typeof RatingSummary>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 0,
    count: 0,
  },
}

export const StackedEmpty: Story = {
  args: {
    value: 0,
    count: 0,
    variant: 'stacked',
  },
}
