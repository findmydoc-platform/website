import type { Meta, StoryObj } from '@storybook/react'
import RichText from '@/components/organisms/RichText'
import { sampleRichText } from './fixtures'

const meta = {
  title: 'Organisms/RichText',
  component: RichText,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RichText>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    data: sampleRichText,
  },
}

export const FullWidthNoProse: Story = {
  args: {
    data: sampleRichText,
    enableGutter: false,
    enableProse: false,
  },
}
