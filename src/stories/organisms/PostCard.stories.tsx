import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PostCard } from '@/components/organisms/PostCard'
import { sampleCardPost } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'

const meta = {
  title: 'Organisms/PostCard',
  component: PostCard.Root,
  decorators: [withMockRouter],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    doc: sampleCardPost,
    relationTo: 'posts',
    children: null, // Satisfy required prop, overridden by render
  },
} satisfies Meta<typeof PostCard.Root>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <PostCard.Root {...args}>
      <PostCard.Media />
      <PostCard.Content>
        <PostCard.Categories />
        <PostCard.Title />
        <PostCard.Description />
      </PostCard.Content>
    </PostCard.Root>
  ),
}

export const WithCustomTitle: Story = {
  render: (args) => (
    <PostCard.Root {...args}>
      <PostCard.Media />
      <PostCard.Content>
        <PostCard.Categories />
        <PostCard.Title title="Featured Preventative Care Guide" />
        <PostCard.Description />
      </PostCard.Content>
    </PostCard.Root>
  ),
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
  render: (args) => (
    <PostCard.Root {...args}>
      <PostCard.Media />
      <PostCard.Content>
        <PostCard.Categories />
        <PostCard.Title />
        <PostCard.Description />
      </PostCard.Content>
    </PostCard.Root>
  ),
}
