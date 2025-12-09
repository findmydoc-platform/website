import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Content } from '@/components/organisms/Content'
import type { ContentColumn } from '@/components/organisms/Content'
import { sampleMedia, sampleRichText } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'

const meta = {
  title: 'Organisms/Content',
  component: Content,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Content>

export default meta

type Story = StoryObj<typeof meta>

const sampleColumns: ContentColumn[] = [
  {
    size: 'oneThird',
    richText: sampleRichText,
    image: sampleMedia,
    imagePosition: 'top',
    imageSize: 'content',
    caption: 'A welcoming clinic environment',
    enableLink: true,
    link: {
      type: 'custom',
      url: '/services',
      label: 'Learn more',
      appearance: 'default',
      newTab: false,
    },
  },
  {
    size: 'oneThird',
    richText: sampleRichText,
    imagePosition: 'top',
    imageSize: 'content',
  },
  {
    size: 'oneThird',
    richText: sampleRichText,
    imagePosition: 'top',
    imageSize: 'content',
  },
]

export const ThreeColumns: Story = {
  args: {
    columns: sampleColumns,
  },
}

export const TwoColumns: Story = {
  args: {
    columns: [
      {
        size: 'half',
        richText: sampleRichText,
        image: sampleMedia,
        imagePosition: 'top',
        imageSize: 'content',
      },
      {
        size: 'half',
        richText: sampleRichText,
        imagePosition: 'top',
        imageSize: 'content',
      },
    ],
  },
}

export const FullWidth: Story = {
  args: {
    columns: [
      {
        size: 'full',
        richText: sampleRichText,
        image: sampleMedia,
        imagePosition: 'top',
        imageSize: 'full',
        caption: 'A full-width banner image',
      },
    ],
  },
}

export const ImageLeft: Story = {
  args: {
    columns: [
      {
        size: 'full',
        richText: sampleRichText,
        image: sampleMedia,
        imagePosition: 'left',
        imageSize: 'content',
      },
    ],
  },
}

export const ImageRight: Story = {
  args: {
    columns: [
      {
        size: 'full',
        richText: sampleRichText,
        image: sampleMedia,
        imagePosition: 'right',
        imageSize: 'content',
      },
    ],
  },
}

export const NoImage: Story = {
  args: {
    columns: [
      {
        size: 'oneThird',
        richText: sampleRichText,
        imagePosition: 'top',
        imageSize: 'content',
      },
      {
        size: 'oneThird',
        richText: sampleRichText,
        imagePosition: 'top',
        imageSize: 'content',
      },
      {
        size: 'oneThird',
        richText: sampleRichText,
        imagePosition: 'top',
        imageSize: 'content',
      },
    ],
  },
}
