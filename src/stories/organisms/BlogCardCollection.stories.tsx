import type { Meta, StoryObj } from '@storybook/react-vite'

import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import type { BlogCardProps } from '@/components/organisms/Blog/BlogCard'
import { clinicBlogData } from '@/stories/fixtures/listings'
import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'

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

export const WithIntro: Story = {
  args: {
    posts: blogPosts,
    intro: 'Stay informed with the latest healthcare insights, medical trends, and expert advice from our team of professionals.',
    variant: 'blue',
  },
}

export const WithMediaBackground: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    posts: blogPosts,
    background: {
      media: {
        src: clinicHospitalExterior,
        alt: 'Blog background',
        imgClassName: 'opacity-40',
        priority: true,
      },
      overlay: {
        kind: 'custom',
        className: 'bg-linear-to-t from-slate-900 via-(--color-slate-900-40) to-transparent',
      },
      parallax: {
        mode: 'scroll',
        rangePx: 24,
        scale: 1.06,
      },
    },
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
