import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Banner } from '@/components/organisms/Banner'
import { sampleRichText } from './fixtures'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

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

// Helper to create rich text content
const createRichText = (text: string): SerializedEditorState => {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [
        {
          type: 'paragraph',
          indent: 0,
          version: 1,
          direction: 'ltr',
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text,
              type: 'text',
              version: 1,
            },
          ],
        },
      ],
    },
  } as unknown as SerializedEditorState
}

export const Info: Story = {
  args: {
    content: sampleRichText,
    style: 'info',
  },
}

export const Success: Story = {
  args: {
    content: createRichText('Your appointment has been successfully booked!'),
    style: 'success',
  },
}

export const Warning: Story = {
  args: {
    content: createRichText('Please review your information before submitting.'),
    style: 'warning',
  },
}

export const Error: Story = {
  args: {
    content: createRichText('An error occurred while processing your request.'),
    style: 'error',
  },
}
