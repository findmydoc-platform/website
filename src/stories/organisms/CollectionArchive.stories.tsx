import type { Meta, StoryObj } from '@storybook/react-vite'
import { CollectionArchive } from '@/components/organisms/CollectionArchive'
import { collectionPosts } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'

const meta = {
  title: 'Organisms/CollectionArchive',
  component: CollectionArchive,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CollectionArchive>

export default meta

type Story = StoryObj<typeof meta>

export const ThreePosts: Story = {
  args: {
    posts: collectionPosts,
  },
}

export const SinglePost: Story = {
  args: {
    posts: collectionPosts.slice(0, 1),
  },
}
