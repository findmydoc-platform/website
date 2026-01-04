import type { Meta, StoryObj } from '@storybook/react-vite'
import { within, expect } from '@storybook/test'
import { Content } from '@/components/organisms/Content'
import type { ContentColumn } from '@/components/organisms/Content'
import { withMockRouter } from '../utils/routerDecorator'

import contentClinicInterior from '@/stories/assets/content-clinic-interior.jpg'

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
  src: contentClinicInterior.src,
  width: 1600,
  height: 1063,
  alt: 'Bright clinic interior corridor',
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

const sampleHeadline = 'Simple content block'
const sampleBody =
  'This is placeholder rich text used in Storybook. In the app, the Payload block adapter pre-renders Lexical rich text into a React node.'

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
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('img', { name: sampleImage.alt })).toBeInTheDocument()
    expect(canvas.getByText(sampleHeadline)).toBeInTheDocument()
    expect(canvas.getByText(sampleBody)).toBeInTheDocument()
    const caption = args.columns?.[0]?.caption
    if (caption) {
      expect(canvas.getByText(caption)).toBeInTheDocument()
    }
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('img', { name: sampleImage.alt })).toBeInTheDocument()
    expect(canvas.getByText(sampleHeadline)).toBeInTheDocument()
    expect(canvas.getByText(sampleBody)).toBeInTheDocument()
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('img', { name: sampleImage.alt })).toBeInTheDocument()
    expect(canvas.getByText(sampleHeadline)).toBeInTheDocument()
    expect(canvas.getByText(sampleBody)).toBeInTheDocument()
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
