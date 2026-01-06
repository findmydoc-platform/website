import type { Meta, StoryObj } from '@storybook/react-vite'
import { Rank } from '@/components/atoms/Rank'

const meta = {
  title: 'Atoms/Rank',
  component: Rank,
  tags: ['autodocs'],
} satisfies Meta<typeof Rank>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { value: 1 },
}

export const Small: Story = {
  args: { value: 5, size: 'sm' },
}

export const Large: Story = {
  args: { value: 10, size: 'lg' },
}
