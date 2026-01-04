import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageRange } from '@/components/molecules/PageRange'

const meta = {
  title: 'Molecules/PageRange',
  component: PageRange,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PageRange>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPage: 2,
    limit: 10,
    totalDocs: 47,
    collection: 'posts',
  },
}

export const Empty: Story = {
  args: {
    totalDocs: 0,
  },
}
