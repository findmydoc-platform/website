import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Banner } from '@/components/organisms/Banner'
import { sampleRichText } from './fixtures'

const meta = {
  title: 'Organisms/Banner',
  component: Banner,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Banner>

export default meta

type Story = StoryObj<typeof meta>

export const Info: Story = {
  args: {
    content: sampleRichText,
    style: 'info',
  },
}

export const Success: Story = {
  args: {
    content: {
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
                text: 'Your appointment has been successfully booked!',
                type: 'text',
                version: 1,
              },
            ],
          },
        ],
      },
    },
    style: 'success',
  },
}

export const Warning: Story = {
  args: {
    content: {
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
                text: 'Please review your information before submitting.',
                type: 'text',
                version: 1,
              },
            ],
          },
        ],
      },
    },
    style: 'warning',
  },
}

export const Error: Story = {
  args: {
    content: {
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
                text: 'An error occurred while processing your request.',
                type: 'text',
                version: 1,
              },
            ],
          },
        ],
      },
    },
    style: 'error',
  },
}
