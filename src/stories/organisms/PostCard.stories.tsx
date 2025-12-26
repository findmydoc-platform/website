import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import { sampleCardPost } from './fixtures'

const meta = {
  title: 'Organisms/PostCard',
  component: BlogCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BlogCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: sampleCardPost,
}

export const WithCustomTitle: Story = {
  args: {
    ...sampleCardPost,
    title: 'Featured Preventative Care Guide',
  },
}

export const MissingImage: Story = {
  args: {
    ...sampleCardPost,
    image: undefined,
  },
}
