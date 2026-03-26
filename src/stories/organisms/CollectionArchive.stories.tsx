import type { Meta, StoryObj } from '@storybook/react-vite'
import { CollectionArchive } from '@/components/organisms/CollectionArchive'
import { collectionPosts } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'

const meta = {
  title: 'Domain/Cms/Organisms/CollectionArchive',
  component: CollectionArchive,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:cms', 'layer:organism', 'status:stable', 'used-in:block:collection-archive'],
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
