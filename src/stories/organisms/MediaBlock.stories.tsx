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

const mediaVideo = {
  ...sampleMedia,
  // Tell the Media molecule to render this as a video.
  mimeType: 'video/mp4',
  // Use a public MP4 URL so Storybook can load it directly.
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
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

export const WithVideo: Story = {
  args: {
    media: mediaVideo,
    enableGutter: true,
  },
}
