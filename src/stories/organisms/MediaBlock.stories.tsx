import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MediaBlock } from '@/components/organisms/MediaBlock'
import { sampleMedia, sampleRichText } from './fixtures'

const meta = {
  title: 'Organisms/MediaBlock',
  component: MediaBlock,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MediaBlock>

export default meta

type Story = StoryObj<typeof meta>

const mediaWithCaption = {
  ...sampleMedia,
  caption: sampleRichText,
}

export const WithCaption: Story = {
  args: {
    media: mediaWithCaption,
    enableGutter: true,
  },
}

export const WithoutCaption: Story = {
  args: {
    media: sampleMedia,
    enableGutter: true,
  },
}

export const NoGutter: Story = {
  args: {
    media: mediaWithCaption,
    enableGutter: false,
  },
}

export const CustomStyling: Story = {
  args: {
    media: mediaWithCaption,
    enableGutter: true,
    imgClassName: 'opacity-80',
    captionClassName: 'text-center',
  },
}
