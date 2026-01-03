import type { Meta, StoryObj } from '@storybook/react-vite'

import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import ph270x292 from '@/stories/assets/placeholder-270-292.png'

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
      src: ph270x292,
      alt: 'Future of customer support',
    },
  },
}

export const Inverted: Story = {
  args: {
    ...Default.args,
    variant: 'inverted',
  },
}
