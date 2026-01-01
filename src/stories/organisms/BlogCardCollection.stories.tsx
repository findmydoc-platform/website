import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import type { BlogCardProps } from '@/components/organisms/Blog/BlogCard'
import { clinicBlogData } from '@/stories/fixtures/listings'

const meta = {
  title: 'Organisms/BlogCardCollection',
  component: BlogCardCollection,
  tags: ['autodocs'],
} satisfies Meta<typeof BlogCardCollection>

export default meta

type Story = StoryObj<typeof meta>

const blogPosts: BlogCardProps[] = clinicBlogData.map((post) => ({
  title: post.title,
  excerpt: post.excerpt,
  dateLabel: post.date,
  image: post.image ? { src: post.image, alt: post.title } : undefined,
}))

export const Default: Story = {
  args: {
    posts: blogPosts,
  },
}

export const BlueVariant: Story = {
  args: {
    posts: blogPosts,
    variant: 'blue',
  },
}

export const NoImage: Story = {
  args: {
    posts: blogPosts.map((post) => ({
      ...post,
      image: undefined,
    })),
  },
}
