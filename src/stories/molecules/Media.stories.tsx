import type { Meta, StoryObj } from '@storybook/react-vite'
import { Media } from '@/components/molecules/Media'
import type { PlatformContentMedia } from '@/payload-types'

const meta = {
  title: 'Molecules/Media',
  component: Media,
  tags: ['autodocs'],
} satisfies Meta<typeof Media>

export default meta
type Story = StoryObj<typeof meta>

const sampleImage: PlatformContentMedia = {
  id: 1,
  alt: 'findmydoc logo',
  createdBy: 1,
  storagePath: 'public/fmd-logo-1-dark.png',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  url: '/fmd-logo-1-dark.png',
  filename: 'fmd-logo-1-dark.png',
  mimeType: 'image/png',
  filesize: 12345,
  width: 200,
  height: 75,
  caption: null,
  prefix: null,
  deletedAt: null,
  thumbnailURL: null,
  sizes: {},
  focalX: null,
  focalY: null,
}

export const ImageResource: Story = {
  args: {
    src: sampleImage.url || '',
    alt: sampleImage.alt || '',
    width: sampleImage.width || undefined,
    height: sampleImage.height || undefined,
    className: 'flex justify-center',
    imgClassName: 'h-20 w-auto',
  },
}

const sampleVideo: PlatformContentMedia = {
  id: 2,
  alt: 'Sample looping video',
  createdBy: 1,
  storagePath: 'public/stories/flower.mp4',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  // Use a public MP4 URL so Storybook can load it without the Payload /media route.
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  filename: 'flower.mp4',
  mimeType: 'video/mp4',
  filesize: 12345,
  width: null,
  height: null,
  caption: null,
  prefix: null,
  deletedAt: null,
  thumbnailURL: null,
  sizes: {},
  focalX: null,
  focalY: null,
}

export const VideoResource: Story = {
  args: {
    src: sampleVideo.url || '',
    alt: sampleVideo.alt || '',
    type: 'video',
    className: 'flex justify-center',
    videoClassName: 'w-full rounded-xl border border-border',
  },
}
