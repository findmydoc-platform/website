import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Content } from '@/components/organisms/Content'
import type { ContentColumn } from '@/components/organisms/Content'
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

const sampleRichTextNode = (
  <div className="space-y-3">
    <p className="text-lg font-semibold">Simple content block</p>
    <p className="text-muted-foreground">
      This is placeholder rich text used in Storybook. In the app, the Payload block adapter pre-renders Lexical rich
      text into a React node.
    </p>
  </div>
)

const sampleImage = {
  src: '/stories/placeholder.svg',
  width: 1200,
  height: 675,
  alt: 'Placeholder content image',
}

const sampleColumns: ContentColumn[] = [
  {
    size: 'oneThird',
    richText: sampleRichTextNode,
    image: sampleImage,
    imagePosition: 'top',
    imageSize: 'content',
    caption: 'A welcoming clinic environment',
    link: {
      href: '/services',
      label: 'Learn more',
      newTab: false,
    },
  },
  {
    size: 'oneThird',
    richText: sampleRichTextNode,
    imagePosition: 'top',
    imageSize: 'content',
  },
  {
    size: 'oneThird',
    richText: sampleRichTextNode,
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
        richText: sampleRichTextNode,
        image: sampleImage,
        imagePosition: 'top',
        imageSize: 'content',
      },
      {
        size: 'half',
        richText: sampleRichTextNode,
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
        richText: sampleRichTextNode,
        image: sampleImage,
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
        richText: sampleRichTextNode,
        image: sampleImage,
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
        richText: sampleRichTextNode,
        image: sampleImage,
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
        richText: sampleRichTextNode,
        imagePosition: 'top',
        imageSize: 'content',
      },
      {
        size: 'oneThird',
        richText: sampleRichTextNode,
        imagePosition: 'top',
        imageSize: 'content',
      },
      {
        size: 'oneThird',
        richText: sampleRichTextNode,
        imagePosition: 'top',
        imageSize: 'content',
      },
    ],
  },
}
