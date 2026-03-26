import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageRange } from '@/components/molecules/PageRange'

const meta = {
  title: 'Shared/Molecules/PageRange',
  component: PageRange,
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
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
