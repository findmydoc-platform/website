import type { Meta, StoryObj } from '@storybook/react-vite'

import { PreviewBadge } from '@/components/atoms/PreviewBadge'

const meta = {
  title: 'Atoms/PreviewBadge',
  component: PreviewBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof PreviewBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="relative h-20 w-52 rounded-md border border-dashed border-muted-foreground/40 bg-background">
      <PreviewBadge />
    </div>
  ),
}
