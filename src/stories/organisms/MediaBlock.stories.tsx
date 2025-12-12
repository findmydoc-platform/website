import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MediaBlock } from '@/components/organisms/MediaBlock'
import { sampleMedia } from './fixtures'

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
  src: sampleMedia.url || '',
  alt: sampleMedia.alt || '',
  width: sampleMedia.width || undefined,
  height: sampleMedia.height || undefined,
  caption: <p>Smiling patient at the clinic</p>,
}

const mediaVideo = {
  src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  alt: 'Sample looping video',
  type: 'video' as const,
}

export const WithCaption: Story = {
  args: {
    ...mediaWithCaption,
    enableGutter: true,
  },
}

export const WithoutCaption: Story = {
  args: {
    src: sampleMedia.url || '',
    alt: sampleMedia.alt || '',
    width: sampleMedia.width || undefined,
    height: sampleMedia.height || undefined,
    enableGutter: true,
  },
}

export const NoGutter: Story = {
  args: {
    ...mediaWithCaption,
    enableGutter: false,
  },
}

export const CustomStyling: Story = {
  args: {
    ...mediaWithCaption,
    enableGutter: true,
    imgClassName: 'opacity-80',
    captionClassName: 'text-center',
  },
}

export const WithVideo: Story = {
  args: {
    ...mediaVideo,
    enableGutter: true,
  },
}
