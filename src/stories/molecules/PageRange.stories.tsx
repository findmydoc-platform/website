import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageRange } from '@/components/molecules/PageRange'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Shared/Molecules/PageRange',
  component: PageRange,
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
} satisfies Meta<typeof PageRange>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPage: 2,
    limit: 10,
    totalDocs: 47,
    collection: 'posts',
  },
}

export const Empty: Story = {
  args: {
    totalDocs: 0,
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')
