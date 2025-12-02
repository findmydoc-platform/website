import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PostCard } from '@/components/organisms/PostCard'
import { sampleCardPost } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'

const meta = {
  title: 'Organisms/PostCard',
  component: PostCard,
  decorators: [withMockRouter],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    doc: sampleCardPost,
    relationTo: 'posts',
    showCategories: true,
  },
} satisfies Meta<typeof PostCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithCustomTitle: Story = {
  args: {
    title: 'Featured Preventative Care Guide',
  },
}

export const MissingImage: Story = {
  args: {
    doc: {
      ...sampleCardPost,
      meta: {
        ...sampleCardPost.meta,
        image: null,
      },
    },
  },
}
