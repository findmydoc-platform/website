import type { Meta, StoryObj } from '@storybook/react-vite'
import RichText from '@/blocks/_shared/RichText'
import { sampleRichText } from './fixtures'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Domain/Cms/Organisms/RichText',
  component: RichText,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs', 'domain:cms', 'layer:organism', 'status:stable', 'used-in:block:rich-text'],
} satisfies Meta<typeof RichText>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    data: sampleRichText,
  },
}

export const FullWidthNoProse: Story = {
  args: {
    data: sampleRichText,
    enableGutter: false,
    enableProse: false,
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')
