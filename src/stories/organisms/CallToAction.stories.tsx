import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CallToAction } from '@/components/organisms/CallToAction'
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
    richText: <p className="text-base">Ready to take the next step?</p>,
    links: [
      {
        href: '/contact',
        label: 'Book a consultation',
        appearance: 'default',
        newTab: false,
      },
    ],
  },
}

export const TwoLinks: Story = {
  args: {
    richText: <p className="text-base">Ready to take the next step in your healthcare journey?</p>,
    links: [
      {
        href: '/contact',
        label: 'Book now',
        appearance: 'default',
        newTab: false,
      },
      {
        href: '/services',
        label: 'Browse services',
        appearance: 'outline',
        newTab: false,
      },
    ],
  },
}

export const NoLinks: Story = {
  args: {
    richText: <p className="text-base">Ready to take the next step?</p>,
    links: [],
  },
}
