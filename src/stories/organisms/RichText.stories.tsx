import type { Meta, StoryObj } from '@storybook/react-vite'
import RichText from '@/blocks/_shared/RichText'
import { sampleRichText } from './fixtures'

const meta = {
  title: 'Domain/Cms/Organisms/RichText',
  component: RichText,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs', 'domain:cms', 'layer:organism', 'status:stable', 'used-in:block:rich-text'],
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
