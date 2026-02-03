import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'
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
  src: '/stories/flower.mp4',
  alt: 'Sample looping video',
  type: 'video' as const,
}

const sampleAltText = sampleMedia.alt
const sampleCaptionText = 'Smiling patient at the clinic'

export const WithCaption: Story = {
  args: {
    ...mediaWithCaption,
    enableGutter: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('img', { name: sampleAltText })).toBeInTheDocument()
    expect(canvas.getByText(sampleCaptionText)).toBeInTheDocument()
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('img', { name: sampleAltText })).toBeInTheDocument()
    expect(canvas.queryByText(sampleCaptionText)).not.toBeInTheDocument()
  },
}

export const NoGutter: Story = {
  args: {
    ...mediaWithCaption,
    enableGutter: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('img', { name: sampleAltText })).toBeInTheDocument()
    expect(canvas.getByText(sampleCaptionText)).toBeInTheDocument()
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
