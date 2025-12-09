import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CallToAction } from '@/components/organisms/CallToAction'
import { sampleRichText } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'

const meta = {
  title: 'Organisms/CallToAction',
  component: CallToAction,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CallToAction>

export default meta

type Story = StoryObj<typeof meta>

export const SingleLink: Story = {
  args: {
    richText: sampleRichText,
    links: [
      {
        link: {
          type: 'custom',
          url: '/contact',
          label: 'Book a consultation',
          appearance: 'default',
          newTab: false,
        },
      },
    ],
  },
}

export const TwoLinks: Story = {
  args: {
    richText: {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'paragraph',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Ready to take the next step in your healthcare journey?',
                type: 'text',
                version: 1,
              },
            ],
          },
        ],
      },
    },
    links: [
      {
        link: {
          type: 'custom',
          url: '/contact',
          label: 'Book now',
          appearance: 'default',
          newTab: false,
        },
      },
      {
        link: {
          type: 'custom',
          url: '/services',
          label: 'Browse services',
          appearance: 'outline',
          newTab: false,
        },
      },
    ],
  },
}

export const NoLinks: Story = {
  args: {
    richText: sampleRichText,
    links: [],
  },
}
