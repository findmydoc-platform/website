import type { Meta, StoryObj } from '@storybook/react-vite'
import { PostHero } from '@/components/organisms/Heroes/PostHero'
import { samplePost } from './fixtures'

const meta = {
  title: 'Organisms/Heroes/PostHero',
  component: PostHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PostHero>

export default meta

type Story = StoryObj<typeof meta>

export const FeaturedPost: Story = {
  args: {
    title: samplePost.title,
    categories: samplePost.categories
      ?.map((c) => (typeof c === 'object' && c !== null ? c.title : null))
      .filter((t): t is string => typeof t === 'string'),
    authors: 'Dr. Maya Patel',
    publishedAt: samplePost.publishedAt || undefined,
    image: {
      src: samplePost.heroImage && typeof samplePost.heroImage === 'object' ? samplePost.heroImage.url || '' : '',
      alt: samplePost.heroImage && typeof samplePost.heroImage === 'object' ? samplePost.heroImage.alt || '' : '',
    },
  },
}
