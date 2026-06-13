import type { Meta, StoryObj } from '@storybook/react-vite'

import { RatingFilter } from '@/components/molecules/RatingFilter'

const meta: Meta<typeof RatingFilter> = {
  title: 'Shared/Molecules/RatingFilter',
  component: RatingFilter,
  parameters: {
    docs: {
      description: {
        component:
          'MVP-safe Storybook coverage does not render populated rating filters until the public verification process is defined.',
      },
    },
  },
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
}

export default meta

type Story = StoryObj<typeof RatingFilter>

export const Default: Story = {
  render: () => (
    <p className="max-w-sm rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
      Rating filter stories are intentionally not rendered in the MVP-safe Storybook fixture set.
    </p>
  ),
}
