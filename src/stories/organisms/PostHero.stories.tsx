import type { Meta, StoryObj } from '@storybook/nextjs-vite'
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
    post: samplePost,
  },
}
