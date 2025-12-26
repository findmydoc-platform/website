import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { BlogCard } from '@/components/organisms/BlogCard'

const meta = {
  title: 'Organisms/BlogCard',
  component: BlogCard,
  tags: ['autodocs'],
} satisfies Meta<typeof BlogCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    dateLabel: '20 august 2019',
    title: 'Future of customer support',
    excerpt:
      'Lorem ipsum dolor euismod invidunt pro, ne his dolorum molestie reprehendunt, quo luptatum evertitur integre suavitate per an.',
    image: {
      src: 'https://placehold.co/270x292.png',
      alt: 'Future of customer support',
    },
  },
}
